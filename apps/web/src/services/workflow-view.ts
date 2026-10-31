import { formatAppointment } from '../utils/format';
import { randomUUID } from 'node:crypto';
import { WORKFLOW_KINDS, type Workflow, type AppState } from '@resolve/contracts';
import { COPY } from '../consts/copy';
export function workflowReview(workflow: Workflow) {
  const text = COPY.workflows;
  return {
    stateLabel:
      workflow.state === 'succeeded' && workflow.action?.kind === 'privacy_request'
        ? text.privacyCaseOpened
        : text.state[workflow.state],
    title: workflow.action ? text.kinds[workflow.action.kind].title : text.archived,
    confirm: workflow.state === 'awaiting_confirmation',
    execute: workflow.state === 'ready',
    reconcile: ['executing', 'unknown'].includes(workflow.state),
    actionDetails: workflowDetails(workflow),
    checkLabel: (code: string) =>
      Object.hasOwn(text.checks, code)
        ? text.checks[code as keyof typeof text.checks]
        : text.additionalCheck,
  };
}
export function workflowCards(state: AppState) {
  return WORKFLOW_KINDS.map((kind) => ({
    kind,
    idempotencyKey: randomUUID(),
    title: COPY.workflows.kinds[kind].title,
    body: COPY.workflows.kinds[kind].body,
    enabled: state.workflowPolicy.enabledActions.includes(kind),
  }));
}

function workflowDetails(workflow: Workflow): Array<{ label: string; value: string }> {
  const action = workflow.action;
  const text = COPY.workflows;
  if (!action) return [];
  switch (action.kind) {
    case 'change_address':
      return [
        { label: text.address, value: action.address.line1 },
        { label: text.city, value: action.address.city },
        { label: text.postalCode, value: action.address.postalCode },
        { label: text.country, value: action.address.country },
      ];
    case 'arrange_return':
      return [
        { label: text.quantity, value: String(action.quantity) },
        {
          label: text.resolution,
          value: action.resolution === 'return' ? text.return : text.replacement,
        },
        { label: text.reason, value: action.reason },
      ];
    case 'reschedule_appointment':
      return [{ label: text.slot, value: action.slotId }];
    case 'recover_account':
      return [{ label: text.account, value: action.resourceId }];
    case 'update_preferences':
      return [
        { label: text.marketing, value: action.marketingEmail ? text.on : text.off },
        { label: text.updates, value: action.productUpdates ? text.on : text.off },
      ];
    case 'privacy_request':
      return [
        {
          label: text.requestType,
          value: action.requestType === 'access' ? text.access : text.erasure,
        },
      ];
  }
}
export function currentAppointment(state: AppState): string {
  const slot = state.demoService?.appointment.slots.find(
    (slot) => slot.id === state.demoService?.appointment.slotId,
  );
  return slot ? formatAppointment(slot.startsAt) : COPY.workflows.originalSlot;
}
