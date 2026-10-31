import { modelBillingContext } from '../helpers/summary';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  RoutingAnalysisSchema,
  type RoutingAnalysis,
  type Decision,
  type SupportCase,
} from '@resolve/contracts';
import { environment } from '../../config/environment';
import { ConnectionsService } from '../../connections/connections.service';
import { requestJson } from '../../common/http/json-client';
import { invalid } from '../../common/errors';
import { PolicyContextService } from '../prompts/policy-context.service';
import { taskPrompt, type PolicySnapshot } from '../prompts/prompt-builder';
import type { PromptTask } from '../prompts/foundation';
const envelope = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});
@Injectable()
export class MistralProvider {
  constructor(
    private readonly connections: ConnectionsService,
    private readonly policies: PolicyContextService,
  ) {}
  private async complete<T>(
    task: PromptTask,
    snapshot: PolicySnapshot,
    record: SupportCase,
    state: unknown,
    schema: z.ZodType<T>,
    model = environment.MISTRAL_MODEL,
  ): Promise<T> {
    if (!this.connections.getMistralKey()) invalid('MISTRAL_KEY_REQUIRED');
    await this.policies.assertExternalAllowed(snapshot, record);
    const response = await requestJson('https://api.mistral.ai/v1/chat/completions', envelope, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.connections.getMistralKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 700,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: taskPrompt(snapshot, task) },
          { role: 'user', content: JSON.stringify(state) },
        ],
      }),
    });
    const content = response.choices[0]?.message.content;
    if (!content) invalid('INVALID_MODEL_RESPONSE');
    const data: unknown = JSON.parse(content);
    return schema.parse(data);
  }
  async route(
    message: string,
    record: SupportCase,
    snapshot: PolicySnapshot,
  ): Promise<RoutingAnalysis> {
    return this.complete(
      'route',
      snapshot,
      record,
      { customerMessage: message, billingFacts: modelBillingContext(record) },
      RoutingAnalysisSchema,
    );
  }
  async judge(
    message: string,
    record: SupportCase,
    snapshot: PolicySnapshot,
    allowed: readonly string[],
    model = environment.MISTRAL_MODEL,
  ): Promise<Decision> {
    const schema = z
      .object({
        action: z.enum(['refund', 'cancel', 'review', 'request_info']),
        risk: z.number().min(0).max(2),
        fulfillment: z.number().min(0).max(2),
        rationale: z.string().max(1000),
        reply: z.string().max(2000),
      })
      .strict();
    const parsed = await this.complete(
      'judge',
      snapshot,
      record,
      {
        customerMessage: message,
        billingFacts: modelBillingContext(record),
        permittedActions: allowed,
      },
      schema,
      model,
    );
    if (!allowed.includes(parsed.action)) invalid('INVALID_MODEL_RESPONSE');
    return {
      ...parsed,
      action: parsed.risk > 1 ? 'review' : parsed.action,
      reply: parsed.risk > 1 ? '' : parsed.reply,
      confidence: null,
      source: model,
    };
  }
}
