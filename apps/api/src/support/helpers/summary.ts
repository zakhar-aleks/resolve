import type { Analysis, SupportCase } from '@resolve/contracts';
export function localSummary(record: SupportCase, intent: Analysis['intent']): string {
  if (record.provider === 'unlinked')
    return intent === 'refund'
      ? /twice|duplicate/iu.test(record.message)
        ? 'Customer reports being charged twice. Verify the account and extra payment before offering a refund.'
        : 'Customer asks about a payment. Link the billing record and verify ownership before offering a refund.'
      : intent === 'cancel'
        ? 'Customer wants to cancel. Verify the account and subscription before making changes.'
        : 'Customer needs help. Review the message and confirm the account details.';
  const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    record.amountCents / 100,
  );
  if (intent === 'cancel')
    return 'Customer wants to cancel their subscription. Review the timing under your company’s policy.';
  if (record.reason === 'duplicate')
    return `Customer reports a duplicate ${amount} payment and requests the extra charge back.`;
  if (intent === 'refund')
    return `Customer requests a ${amount} refund for a payment made ${record.ageDays} ${record.ageDays === 1 ? 'day' : 'days'} ago.`;
  return 'Customer reports an unrecognized payment. Verify the charge with them before taking action.';
}
export function suggestedTags(record: SupportCase, intent: Analysis['intent']): string[] {
  return intent === 'cancel'
    ? ['Subscriptions', 'Cancellation']
    : record.reason === 'duplicate'
      ? ['Billing', 'Duplicate charge']
      : intent === 'refund'
        ? ['Billing', 'Refund']
        : ['Needs review'];
}
export function modelBillingContext(record: SupportCase) {
  return {
    amountCents: record.amountCents,
    ageDays: record.ageDays,
    reason: record.reason,
    refundedCents: record.refundedCents,
    currency: record.currency,
    paymentStatus: record.paymentStatus,
    billingLinked: record.provider !== 'unlinked',
  };
}
