import { copyText } from '../helpers/copy';
import type { AppState, BillingOperation, SupportRun } from '@resolve/contracts';
import { COPY } from '../consts/copy';
import { formatMoney } from '../utils/format';
import type { WorkspaceModel } from '../types/workspace';
export function supportPresentation(model: WorkspaceModel) {
  const { run, operation, record, state } = model;
  const succeeded = operation?.state === 'succeeded';
  const actionable = run !== null && ['refund', 'cancel'].includes(run.decision.action);
  const currentPolicy = run?.company.revision === state.company.revision;
  const canExecute =
    actionable &&
    currentPolicy &&
    run?.privacyRevision === state.privacy.revision &&
    record?.triageStatus !== 'pending' &&
    record?.triageStatus !== 'processing' &&
    !operation &&
    !record?.archivedAt;
  const canReconcile =
    operation !== null && ['dispatched', 'unknown', 'pending'].includes(operation.state);
  const headline = operation
    ? succeeded
      ? COPY.support.verified
      : operation.state === 'unknown' || operation.state === 'dispatched'
        ? COPY.support.uncertain
        : COPY.states[operation.state]
    : run
      ? actionable
        ? COPY.support.prepared
        : run.decision.action === 'request_info'
          ? COPY.support.information
          : COPY.support.review
      : COPY.support.ready;
  const description = operation
    ? succeeded
      ? operation.action === 'refund'
        ? copyText.refundVerified(
            formatMoney(operation.amountCents),
            record?.provider === 'simulator',
          )
        : COPY.support.cancelVerified
      : operation.state === 'pending'
        ? COPY.support.pendingBody
        : COPY.support.unknownBody
    : run
      ? actionable
        ? run.decision.action === 'refund'
          ? copyText.eligible(formatMoney(run.amountCents))
          : COPY.actions.cancel
        : COPY.support.noAction
      : COPY.support.readyBody;
  const customer = record?.name.split(' ')[0] ?? '';
  const reply = succeeded
    ? operation?.action === 'refund'
      ? copyText.refundReply(
          customer,
          formatMoney(operation.amountCents),
          state.company.agentName,
          state.company.companyName,
        )
      : copyText.cancelReply(customer, state.company.agentName, state.company.companyName)
    : (run?.decision.reply ?? '');
  return {
    headline,
    description,
    reply,
    canExecute,
    canReconcile,
    stale:
      run !== null &&
      (!currentPolicy || run.privacyRevision !== state.privacy.revision) &&
      !operation,
    actionLabel:
      run?.decision.action === 'refund'
        ? copyText.refund(formatMoney(run.amountCents))
        : COPY.support.executeCancel,
    recommendation: operation
      ? succeeded
        ? COPY.support.verified
        : canReconcile
          ? COPY.support.reconcile
          : COPY.states[operation.state]
      : run
        ? COPY.actions[run.decision.action]
        : COPY.support.awaiting,
    confidence:
      run?.decision.confidence === null || !run
        ? COPY.support.notProvided
        : copyText.percentage(run.decision.confidence),
    risk: copyText.score(run?.decision.risk ?? null),
    fulfillment: copyText.score(run?.decision.fulfillment ?? null),
    source: run ? copyText.source(run.decision.source) : COPY.support.judgmentBoundary,
  };
}
export function receiptLines(operation: BillingOperation) {
  return [
    { label: COPY.support.operation, value: operation.id },
    { label: COPY.support.receipt, value: operation.receipt?.id ?? COPY.support.awaitingReceipt },
    { label: COPY.support.status, value: COPY.states[operation.state] },
  ];
}
export function checkDetail(check: SupportRun['checks'][number]): string {
  if (check.id === 'refund_window' && check.value !== null) return copyText.days(check.value);
  if (check.id === 'payment_limit' && check.value !== null) return formatMoney(check.value);
  return COPY.checks[check.id][1];
}

export function supportMetrics(state: AppState) {
  const text = COPY.experience;
  return [
    {
      label: text.queue,
      value: copyText.count(state.cases.filter((record) => record.status !== 'resolved').length),
      detail: text.queueDetail,
    },
    {
      label: text.attention,
      value: copyText.count(
        state.cases.filter(
          (record) => record.status !== 'resolved' && record.triageStatus === 'review',
        ).length,
      ),
      detail: text.attentionDetail,
    },
    {
      label: text.resolvedLabel,
      value: copyText.count(state.cases.filter((record) => record.status === 'resolved').length),
      detail: text.resolvedDetail,
    },
    { label: text.privacyLabel, value: text.privacyValue, detail: text.privacyDetail },
  ];
}
