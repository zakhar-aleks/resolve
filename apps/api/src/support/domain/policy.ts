import type {
  ActionSchema,
  Analysis,
  CompanyProfile,
  Decision,
  PolicyCheck,
  SupportCase,
  SupportRun,
} from '@resolve/contracts';
import type { z } from 'zod';
export function evaluatePolicy(
  record: SupportCase,
  intent: Analysis['intent'],
  company: CompanyProfile,
): PolicyCheck[] {
  const check = (
    id: PolicyCheck['id'],
    passed: boolean,
    value: number | null = null,
  ): PolicyCheck => ({ id, passed, value });
  const common = [
    check('ownership', record.customerId.length > 0),
    check('authorization', !company.reviewAll),
  ];
  if (intent === 'cancel')
    return [
      ...common,
      check('cancellation_enabled', company.cancellationsEnabled),
      check(
        'active_subscription',
        record.provider === 'simulator' && record.subscriptionStatus === 'active',
      ),
    ];
  return [
    ...common,
    check('refunds_enabled', company.refundsEnabled),
    check('duplicate_evidence', !company.duplicateOnly || record.reason === 'duplicate'),
    check('payment_completed', ['paid', 'succeeded'].includes(record.paymentStatus)),
    check('refund_window', record.ageDays <= company.refundWindowDays, company.refundWindowDays),
    check(
      'payment_limit',
      record.amountCents <= company.maximumPaymentCents,
      company.maximumPaymentCents,
    ),
    check('refundable_balance', record.amountCents > record.refundedCents),
    check('currency', record.currency === 'usd'),
  ];
}
export function allowedActions(
  intent: Analysis['intent'],
  checks: PolicyCheck[],
): z.infer<typeof ActionSchema>[] {
  const actions: z.infer<typeof ActionSchema>[] = ['review', 'request_info'];
  if (intent !== 'investigate' && checks.every((check) => check.passed)) actions.unshift(intent);
  return actions;
}
export function rulesDecision(
  record: SupportCase,
  analysis: Analysis,
  company: CompanyProfile,
  allowed: readonly string[],
): Decision {
  const permitted =
    analysis.intent !== 'investigate' &&
    allowed.includes(analysis.intent) &&
    record.reason !== 'unknown' &&
    !company.writtenPolicy.trim();
  return {
    action: permitted && analysis.intent !== 'investigate' ? analysis.intent : 'review',
    confidence: null,
    risk: null,
    fulfillment: null,
    rationale: '',
    reply: '',
    source: 'rules',
  };
}
export function approvalFailure(
  run: SupportRun,
  company: CompanyProfile,
  record: SupportCase,
  now: Date,
): string | null {
  if (run.company.revision !== company.revision) return 'POLICY_CHANGED';
  if (now.getTime() - Date.parse(run.createdAt) > 600000) return 'DECISION_EXPIRED';
  if (!['refund', 'cancel'].includes(run.decision.action)) return 'ACTION_NOT_AUTHORIZED';
  const intent = run.decision.action === 'refund' ? 'refund' : 'cancel';
  if (!evaluatePolicy(record, intent, company).every((check) => check.passed))
    return 'BILLING_STATE_CHANGED';
  if (run.amountCents !== record.amountCents - record.refundedCents) return 'AMOUNT_CHANGED';
  return null;
}
