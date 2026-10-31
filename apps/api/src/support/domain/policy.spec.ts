import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMPANY,
  CaseSchema,
  type Analysis,
  type SupportCase,
  type SupportRun,
} from '@resolve/contracts';
import { evaluatePolicy, allowedActions, rulesDecision, approvalFailure } from './policy';
const record: SupportCase = CaseSchema.parse({
  id: 'test',
  name: 'Jamie',
  title: 'Duplicate',
  message: 'Refund duplicate',
  amountCents: 2900,
  ageDays: 1,
  reason: 'duplicate',
  customerId: 'cus_test',
  paymentId: 'pi_test',
  refundedCents: 0,
  currency: 'usd',
  provider: 'simulator',
  paymentStatus: 'paid',
  subscriptionStatus: 'active',
});
const analysis: Analysis = { intent: 'refund', summary: record.message, source: 'rules' };
function run(): SupportRun {
  return {
    privacyRevision: 'privacy-v1',
    id: crypto.randomUUID(),
    caseId: record.id,
    message: record.message,
    company: DEFAULT_COMPANY,
    analysis,
    checks: evaluatePolicy(record, 'refund', DEFAULT_COMPANY),
    decision: rulesDecision(record, analysis, DEFAULT_COMPANY, ['refund', 'review']),
    amountCents: 2900,
    elapsedMs: 1,
    createdAt: new Date().toISOString(),
  };
}
describe('billing policy', () => {
  it('permits a verified duplicate under the configured limits', () => {
    expect(allowedActions('refund', evaluatePolicy(record, 'refund', DEFAULT_COMPANY))).toContain(
      'refund',
    );
  });
  it.each([
    { ...record, ageDays: 31 },
    { ...record, amountCents: 10001 },
    { ...record, refundedCents: 2900 },
    { ...record, reason: 'unknown' as const },
    { ...record, paymentStatus: 'requires_capture' },
    { ...record, customerId: '' },
  ])('blocks invalid billing evidence %#', (input) => {
    expect(
      allowedActions('refund', evaluatePolicy(input, 'refund', DEFAULT_COMPANY)),
    ).not.toContain('refund');
  });
  it('enforces company action switches', () => {
    expect(
      allowedActions(
        'refund',
        evaluatePolicy(record, 'refund', { ...DEFAULT_COMPANY, refundsEnabled: false }),
      ),
    ).not.toContain('refund');
    expect(
      allowedActions(
        'cancel',
        evaluatePolicy(record, 'cancel', { ...DEFAULT_COMPANY, cancellationsEnabled: false }),
      ),
    ).not.toContain('cancel');
  });
  it('does not interpret written policy in rules mode', () => {
    expect(
      rulesDecision(
        record,
        analysis,
        { ...DEFAULT_COMPANY, writtenPolicy: 'Manager approval required' },
        ['refund', 'review'],
      ).action,
    ).toBe('review');
  });
  it('supports standard refunds only after company opt-in', () => {
    const standard = { ...record, reason: 'requested' as const };
    expect(
      allowedActions('refund', evaluatePolicy(standard, 'refund', DEFAULT_COMPANY)),
    ).not.toContain('refund');
    expect(
      allowedActions(
        'refund',
        evaluatePolicy(standard, 'refund', { ...DEFAULT_COMPANY, duplicateOnly: false }),
      ),
    ).toContain('refund');
  });
  it('invalidates stale policy revisions', () => {
    expect(
      approvalFailure(run(), { ...DEFAULT_COMPANY, revision: 'new' }, record, new Date()),
    ).toBe('POLICY_CHANGED');
  });
  it('expires decisions after ten minutes', () => {
    const value = run();
    value.createdAt = new Date(Date.now() - 600001).toISOString();
    expect(approvalFailure(value, DEFAULT_COMPANY, record, new Date())).toBe('DECISION_EXPIRED');
  });
  it('rejects a changed remaining amount', () => {
    expect(
      approvalFailure(run(), DEFAULT_COMPANY, { ...record, refundedCents: 100 }, new Date()),
    ).toBe('AMOUNT_CHANGED');
  });
  it('retains review-all as a hard restriction', () => {
    expect(
      allowedActions(
        'refund',
        evaluatePolicy(record, 'refund', { ...DEFAULT_COMPANY, reviewAll: true }),
      ),
    ).toEqual(['review', 'request_info']);
  });
});
