import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { ConnectionInput } from '@resolve/contracts';
import { environment } from '../config/environment';
import { invalid } from '../common/errors';
import { requestJson, ProviderError } from '../common/http/json-client';
@Injectable()
export class ConnectionsService {
  private mistralKey = environment.MISTRAL_API_KEY;
  private jevKey = environment.TYPESAFE_API_KEY;
  getMistralKey(): string {
    return this.mistralKey;
  }
  getJevKey(): string {
    return this.jevKey;
  }
  save(input: ConnectionInput): void {
    if (input.provider === 'mistral') this.mistralKey = input.key;
    else this.jevKey = input.key;
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
