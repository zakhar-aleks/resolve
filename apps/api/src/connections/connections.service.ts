import type { SlackSettings } from './service-settings';
import { DataSource } from 'typeorm';
import { workspaceContext } from '../tenancy/context';
import { WorkspaceCredentialEntity } from '../database/entities/account.entity';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { ConnectionInput } from '@resolve/contracts';
import { environment } from '../config/environment';
import { invalid } from '../common/errors';
import { requestJson, ProviderError } from '../common/http/json-client';
@Injectable()
export class ConnectionsService {
  private legacyKeys: Record<string, string> = {};
  constructor(private readonly data: DataSource) {}
  private get mistralKey() {
    return workspaceContext.getStore()
      ? environment.MISTRAL_API_KEY
      : (this.legacyKeys.MISTRAL_API_KEY ?? environment.MISTRAL_API_KEY);
  }
  private get jevKey() {
    return workspaceContext.getStore()
      ? environment.TYPESAFE_API_KEY
      : (this.legacyKeys.TYPESAFE_API_KEY ?? environment.TYPESAFE_API_KEY);
  }
  getMistralKey(): string {
    return this.mistralKey;
  }
  getJevKey(): string {
    return this.jevKey;
  }
  async save(input: ConnectionInput): Promise<void> {
    const name = input.provider === 'mistral' ? 'MISTRAL_API_KEY' : 'TYPESAFE_API_KEY';
    const context = workspaceContext.getStore();
    if (!context) {
      if (environment.ALLOW_BASIC_AUTH !== 'true') invalid('WORKSPACE_REQUIRED');
      this.legacyKeys[name] = input.key;
      return;
    }
    await this.data.getRepository(WorkspaceCredentialEntity).save({ id: name, value: input.key });
    context.secrets[name] = input.key;
  }
  async saveSlack(input: SlackSettings): Promise<void> {
    const context = workspaceContext.getStore();
    if (!context) invalid('WORKSPACE_REQUIRED');
    const values = {
      SLACK_APP_TOKEN: input.appToken,
      SLACK_TEAM_ID: input.teamId,
      SLACK_CHANNEL_IDS: input.channelIds,
      SLACK_BOT_TOKEN: input.botToken,
    };
    await this.data.transaction(async (manager) => {
      for (const [id, value] of Object.entries(values))
        await manager.save(WorkspaceCredentialEntity, { id, value });
    });
    Object.assign(context.secrets, values);
  }
  status() {
    return {
      mistral: !!this.mistralKey,
      jev: !!this.jevKey,
      stripe: /^(sk|rk)_test_/u.test(environment.STRIPE_SECRET_KEY),
      model: environment.MISTRAL_MODEL,
    };
  }
  async testMistral(): Promise<{ ok: boolean; modelAvailable: boolean }> {
    if (!this.mistralKey) invalid('MISTRAL_KEY_REQUIRED');
    try {
      const result = await requestJson(
        'https://api.mistral.ai/v1/models',
        z.object({ data: z.array(z.object({ id: z.string() })) }),
        { headers: { Authorization: `Bearer ${this.mistralKey}` } },
      );
      return {
        ok: true,
        modelAvailable: result.data.some((model) => model.id === environment.MISTRAL_MODEL),
      };
    } catch (error) {
      if (error instanceof ProviderError && error.status === 401) invalid('MISTRAL_KEY_REJECTED');
      invalid('PROVIDER_UNAVAILABLE');
    }
  }
}
