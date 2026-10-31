import { workflowIntent } from '../workflows/domain/intent';
import {
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { SocketModeClient } from '@slack/socket-mode';
import { LogLevel } from '@slack/logger';
import { DataSource } from 'typeorm';
import { parseMention } from './helpers/mention';
import { z } from 'zod';
import { environment } from '../config/environment';
import { CaseEntity } from '../database/entities/case.entity';
const envelopeSchema = z.object({
  body: z.unknown(),
  ack: z.custom<() => Promise<void>>((value) => typeof value === 'function'),
});
@Injectable()
export class SlackService implements OnApplicationBootstrap, OnApplicationShutdown {
  private client: SocketModeClient | undefined;
  private connected = false;
  private failed = false;
  constructor(private readonly data: DataSource) {}
  status() {
    return {
      configured: Boolean(
        environment.SLACK_APP_TOKEN && environment.SLACK_TEAM_ID && environment.SLACK_CHANNEL_IDS,
      ),
      connected: this.connected,
      lastError: this.failed,
    };
  }
  async onApplicationBootstrap(): Promise<void> {
    if (!this.status().configured) return;
    this.client = new SocketModeClient({
      appToken: environment.SLACK_APP_TOKEN,
      logLevel: LogLevel.ERROR,
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        setLevel: () => undefined,
        getLevel: () => LogLevel.ERROR,
        setName: () => undefined,
      },
    });
    this.client.on('connected', () => {
      this.connected = true;
      this.failed = false;
    });
    this.client.on('disconnected', () => {
      this.connected = false;
    });
    this.client.on('error', () => {
      this.failed = true;
    });
    this.client.on('app_mention', (payload: unknown) => {
      void this.receive(payload).catch(() => {
        this.failed = true;
      });
    });
    void this.client.start().catch(() => {
      this.failed = true;
    });
  }
  async onApplicationShutdown(): Promise<void> {
    await this.client?.disconnect();
  }
  private async receive(payload: unknown): Promise<void> {
    const envelope = envelopeSchema.parse(payload);
    const request = parseMention(
      envelope.body,
      environment.SLACK_TEAM_ID,
      environment.SLACK_CHANNEL_IDS,
    );
    const result = await this.store(envelope.body);
    await envelope.ack();
    if (result?.created && request && environment.SLACK_BOT_TOKEN) {
      const body = z
        .object({ event: z.object({ channel: z.string(), ts: z.string() }) })
        .parse(envelope.body);
      const kind = workflowIntent(request.message);
      const labels = {
        change_address: 'delivery address change',
        arrange_return: 'return or replacement',
        reschedule_appointment: 'appointment change',
        recover_account: 'account recovery',
        update_preferences: 'notification preferences',
        privacy_request: 'privacy request',
      } as const;
      const text = `Your request is in the support inbox.${kind ? ` Suggested workflow: ${labels[kind]}.` : ''} A team member will verify the details before any change. ${environment.WEB_ORIGIN}/?view=support&case=${encodeURIComponent(result.id)}`;
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${environment.SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: body.event.channel,
          thread_ts: body.event.ts,
          text,
          unfurl_links: false,
          unfurl_media: false,
        }),
        signal: AbortSignal.timeout(8000),
        redirect: 'error',
      });
      const value: unknown = await response.json();
      if (!z.object({ ok: z.literal(true) }).safeParse(value).success) this.failed = true;
    }
  }
  async ingest(payload: unknown): Promise<string | null> {
    return (await this.store(payload))?.id ?? null;
  }
  private async store(payload: unknown): Promise<{ id: string; created: boolean } | null> {
    const request = parseMention(payload, environment.SLACK_TEAM_ID, environment.SLACK_CHANNEL_IDS);
    if (!request) return null;
    const { id, message, aiPreference } = request;
    const inserted = await this.data
      .createQueryBuilder()
      .insert()
      .into(CaseEntity)
      .values({
        id,
        name: 'Slack requester',
        title: 'New Slack request',
        message,
        amountCents: 0,
        ageDays: 0,
        reason: 'unknown',
        customerId: '',
        paymentId: id,
        refundedCents: 0,
        currency: 'usd',
        provider: 'unlinked',
        paymentStatus: 'unlinked',
        subscriptionStatus: 'active',
        channel: 'slack',
        externalId: id,
        aiPreference,
        tags: ['Slack', ...(workflowIntent(message) ? ['Action requested'] : [])],
        triageStatus: 'pending',
      })
      .orIgnore()
      .returning('id')
      .execute();
    const rows: unknown = inserted.raw;
    return { id, created: z.array(z.object({ id: z.string() })).parse(rows).length > 0 };
  }
}
