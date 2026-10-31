import { it, expect, vi, afterEach } from 'vitest';
import { DataSource } from 'typeorm';
import {
  CaseSchema,
  DEFAULT_COMPANY,
  DEFAULT_PRIVACY,
  DEFAULT_WORKFLOW_POLICY,
} from '@resolve/contracts';
import { SupportOrchestrator } from './support-orchestrator.service';
import { MistralProvider } from '../providers/mistral.provider';
import { JevProvider } from '../providers/jev.provider';
import { ConnectionsService } from '../../connections/connections.service';
import { PolicyContextService } from '../prompts/policy-context.service';
import { buildSnapshot } from '../prompts/prompt-builder';
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
const policies = new PolicyContextService(
  new DataSource({ type: 'postgres', url: 'postgresql://unused' }),
);
const connections = new ConnectionsService();
const mistral = new MistralProvider(connections, policies);
const jev = new JevProvider(connections, policies);
const orchestrator = new SupportOrchestrator(connections, mistral, jev);
afterEach(() => vi.restoreAllMocks());
it.each(['human_only', 'ai_disabled', 'rules_only'] as const)(
  'bypasses every external provider for %s',
  async (reason) => {
    vi.spyOn(connections, 'getMistralKey').mockReturnValue('mock-key');
    vi.spyOn(connections, 'getJevKey').mockReturnValue('mock-key');
    const route = vi.spyOn(mistral, 'route');
    const judge = vi.spyOn(mistral, 'judge');
    const jevRoute = vi.spyOn(jev, 'route');
    const snapshot = buildSnapshot(
      { ...DEFAULT_COMPANY, decisionEngine: reason === 'rules_only' ? 'rules' : 'auto' },
      { ...DEFAULT_PRIVACY, aiEnabled: reason !== 'ai_disabled' },
      DEFAULT_WORKFLOW_POLICY,
    );
    const result = await orchestrator.prepare(
      record.message,
      { ...record, aiPreference: reason === 'human_only' ? 'human_only' : 'allowed' },
      snapshot,
    );
    expect(result.routing.reason).toBe(reason);
    expect(route).not.toHaveBeenCalled();
    expect(judge).not.toHaveBeenCalled();
    expect(jevRoute).not.toHaveBeenCalled();
  },
);
it('keeps a missing explicitly selected Jev connection in human review', async () => {
  vi.spyOn(connections, 'getJevKey').mockReturnValue('');
  const result = await orchestrator.prepare(
    record.message,
    record,
    buildSnapshot(
      { ...DEFAULT_COMPANY, decisionEngine: 'jev' },
      { ...DEFAULT_PRIVACY, aiEnabled: true },
      DEFAULT_WORKFLOW_POLICY,
    ),
  );
  expect(result.routing.destination).toBe('human');
  expect(result.decision.action).toBe('review');
});
it('passes the same policy snapshot to the selected larger model', async () => {
  const { environment } = await import('../../config/environment');
  const previous = environment.MISTRAL_LARGE_MODEL;
  environment.MISTRAL_LARGE_MODEL = 'configured-large';
  try {
    vi.spyOn(connections, 'getMistralKey').mockReturnValue('mock-key');
    vi.spyOn(mistral, 'route').mockResolvedValue({
      scenario: 'refund',
      complexity: 'high',
      summary: 'A complex request',
      policyConflict: false,
      missingInformation: [],
    });
    const judge = vi.spyOn(mistral, 'judge').mockResolvedValue({
      action: 'review',
      confidence: null,
      risk: 1,
      fulfillment: 1,
      rationale: 'Specialist check',
      reply: 'I can help you review this.',
      source: 'configured-large',
    });
    const snapshot = buildSnapshot(
      { ...DEFAULT_COMPANY, routingMode: 'adaptive' },
      { ...DEFAULT_PRIVACY, aiEnabled: true },
      DEFAULT_WORKFLOW_POLICY,
    );
    const result = await orchestrator.prepare(record.message, record, snapshot);
    expect(result.routing.destination).toBe('large');
    expect(judge).toHaveBeenCalledWith(
      record.message,
      record,
      snapshot,
      expect.any(Array),
      'configured-large',
    );
  } finally {
    environment.MISTRAL_LARGE_MODEL = previous;
  }
});
