import { afterEach, it, expect, vi } from 'vitest';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import {
  CaseSchema,
  DEFAULT_COMPANY,
  DEFAULT_PRIVACY,
  DEFAULT_WORKFLOW_POLICY,
} from '@resolve/contracts';
import { JevProvider } from './jev.provider';
import { ConnectionsService } from '../../connections/connections.service';
import { PolicyContextService } from '../prompts/policy-context.service';
import { buildSnapshot } from '../prompts/prompt-builder';
import { SUPPORT_FOUNDATION } from '../prompts/foundation';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('uses the same policy foundation for optional Jev routing and judgment', async () => {
  const record = CaseSchema.parse({
    id: 'fixture',
    name: 'Demo',
    title: 'Help',
    message: 'Refund duplicate',
    amountCents: 2900,
    ageDays: 1,
    reason: 'duplicate',
    customerId: 'owner',
    paymentId: 'payment',
    refundedCents: 0,
    currency: 'usd',
    provider: 'simulator',
    paymentStatus: 'paid',
    subscriptionStatus: 'active',
  });
  const connections = new ConnectionsService();
  vi.spyOn(connections, 'getJevKey').mockReturnValue('mock-key');
  const policies = new PolicyContextService(
    new DataSource({ type: 'postgres', url: 'postgresql://unused' }),
  );
  vi.spyOn(policies, 'assertExternalAllowed').mockResolvedValue();
  const provider = new JevProvider(connections, policies);
  const instructions: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: unknown, init: RequestInit) => {
      const value: unknown = JSON.parse(z.string().parse(init.body));
      const body = z
        .object({ questions: z.record(z.string(), z.object({ instructions: z.string() })) })
        .parse(value);
      const route = body.questions.scenario !== undefined;
      const question = route ? body.questions.scenario : body.questions.resolution;
      if (!question) throw new Error('Expected routing or resolution instructions');
      instructions.push(question.instructions);
      return Response.json({
        answers: route
          ? {
              scenario: { choice: 'refund', confidence: 0.95 },
              complexity: { choice: 'low', confidence: 0.95 },
              policyConflict: { choice: 'no', confidence: 0.95 },
              missingInformation: { choice: 'no', confidence: 0.95 },
            }
          : {
              resolution: { choice: 'review', confidence: 0.95 },
              risk: { score: 0 },
              fulfillment: { score: 1 },
            },
      });
    }),
  );
  const snapshot = buildSnapshot(
    { ...DEFAULT_COMPANY, decisionEngine: 'jev', writtenPolicy: 'Shared company policy' },
    { ...DEFAULT_PRIVACY, aiEnabled: true },
    DEFAULT_WORKFLOW_POLICY,
  );
  expect((await provider.route(record.message, record, snapshot)).scenario).toBe('refund');
  await provider.judge(record.message, record, snapshot, ['review']);
  expect(instructions).toHaveLength(2);
  for (const text of instructions) {
    expect(text.startsWith(SUPPORT_FOUNDATION)).toBe(true);
    expect(text).toContain('Shared company policy');
  }
});
