import {
  WorkflowCreateSchema,
  WorkflowPolicySchema,
  WORKFLOW_KINDS,
  type WorkflowPolicy,
} from '@resolve/contracts';
import { DEMO_WORKFLOW } from '../consts/workflows';
import { text } from './forms';
export function workflowForm(form: FormData) {
  const kind = text(form, 'kind');
  let action: unknown;
  switch (kind) {
    case 'change_address':
      action = {
        kind,
        resourceId: DEMO_WORKFLOW.orderId,
        address: {
          line1: text(form, 'line1'),
          city: text(form, 'city'),
          postalCode: text(form, 'postalCode'),
          country: text(form, 'country'),
        },
      };
      break;
    case 'arrange_return':
      action = {
        kind,
        resourceId: DEMO_WORKFLOW.returnOrderId,
        itemId: DEMO_WORKFLOW.itemId,
        quantity: Number(text(form, 'quantity')),
        resolution: text(form, 'resolution'),
        reason: text(form, 'reason'),
      };
      break;
    case 'reschedule_appointment':
      action = { kind, resourceId: DEMO_WORKFLOW.appointmentId, slotId: text(form, 'slotId') };
      break;
    case 'recover_account':
      action = { kind, resourceId: DEMO_WORKFLOW.accountId };
      break;
    case 'update_preferences':
      action = {
        kind,
        resourceId: DEMO_WORKFLOW.customerId,
        marketingEmail: form.has('marketingEmail'),
        productUpdates: form.has('productUpdates'),
      };
      break;
    case 'privacy_request':
      action = {
        kind,
        resourceId: DEMO_WORKFLOW.customerId,
        requestType: text(form, 'requestType'),
      };
      break;
    default:
      throw new Error('VALIDATION_FAILED');
  }
  return WorkflowCreateSchema.parse({
    customerId: DEMO_WORKFLOW.customerId,
    verificationToken: DEMO_WORKFLOW.verificationToken,
    idempotencyKey: text(form, 'idempotencyKey'),
    mode: 'demo',
    action,
  });
}
export function workflowPolicyForm(form: FormData): WorkflowPolicy {
  return WorkflowPolicySchema.parse({
    revision: text(form, 'revision'),
    enabledActions: WORKFLOW_KINDS.filter((kind) => form.has(kind)),
    maxReplacementCents: Number(text(form, 'maxReplacementCents')),
    returnWindowDays: Number(text(form, 'returnWindowDays')),
    maxRecoveryPerDay: Number(text(form, 'maxRecoveryPerDay')),
  });
}
