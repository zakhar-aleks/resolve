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
    await this.ingest(envelope.body);
    await envelope.ack();
  }
  async ingest(payload: unknown): Promise<string | null> {
    const request = parseMention(payload, environment.SLACK_TEAM_ID, environment.SLACK_CHANNEL_IDS);
    if (!request) return null;
    const { id, message, aiPreference } = request;
    await this.data
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
        tags: ['Slack'],
        triageStatus: 'pending',
      })
      .orIgnore()
      .execute();
    return id;
  }
}
