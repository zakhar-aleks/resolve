import type { WorkflowAction, WorkflowPolicy, DemoState } from '@resolve/contracts';
export const DEMO_CUSTOMER = 'customer_demo';
export const DEMO_PROOF = 'demo-customer-verification';
export type { DemoState } from '@resolve/contracts';
export function initialDemoState(): DemoState {
  const tomorrow = Date.now() + 86400000;
  return {
    version: 1,
    customerId: DEMO_CUSTOMER,
    order: {
      id: 'order_demo',
      status: 'unfulfilled',
      createdAt: new Date().toISOString(),
      address: { line1: '10 Example Street', city: 'Berlin', postalCode: '10115', country: 'DE' },
      itemId: 'item_demo',
      quantity: 2,
      unitCents: 2500,
      stock: 5,
      returned: 0,
      returns: [],
    },
    returnOrder: {
      id: 'return_order_demo',
      status: 'delivered',
      createdAt: new Date().toISOString(),
      address: { line1: '10 Example Street', city: 'Berlin', postalCode: '10115', country: 'DE' },
      itemId: 'item_demo',
      quantity: 2,
      unitCents: 2500,
      stock: 5,
      returned: 0,
      returns: [],
    },
    appointment: {
      id: 'appointment_demo',
      slotId: 'slot_original',
      slots: [
        { id: 'slot_morning', startsAt: new Date(tomorrow).toISOString(), available: true },
        {
          id: 'slot_afternoon',
          startsAt: new Date(tomorrow + 14400000).toISOString(),
          available: true,
        },
      ],
    },
    account: { id: 'account_demo', recoveryRequests: [] },
    preferences: { id: 'customer_demo', marketingEmail: true, productUpdates: true },
    privacyRequests: [],
  };
}
export function demoChecks(
  state: DemoState,
  action: WorkflowAction,
  policy: WorkflowPolicy,
  owner: boolean,
  now = Date.now(),
) {
  const checks = [
    { code: 'ownership_verified', passed: owner },
    { code: 'action_permitted', passed: policy.enabledActions.includes(action.kind) },
  ];
  const add = (code: string, passed: boolean) => checks.push({ code, passed });
  switch (action.kind) {
    case 'change_address':
      add('resource_found', action.resourceId === state.order.id);
      add('order_unfulfilled', state.order.status === 'unfulfilled');
      break;
    case 'arrange_return':
      add('order_delivered', state.returnOrder.status === 'delivered');
      add(
        'resource_found',
        action.resourceId === state.returnOrder.id && action.itemId === state.returnOrder.itemId,
      );
      add(
        'eligible_quantity',
        action.quantity + state.returnOrder.returned <= state.returnOrder.quantity,
      );
      add(
        'within_return_window',
        now - Date.parse(state.returnOrder.createdAt) <= policy.returnWindowDays * 86400000,
      );
      add(
        'value_limit',
        action.quantity * state.returnOrder.unitCents <= policy.maxReplacementCents,
      );
      add(
        'stock_available',
        action.resolution === 'return' || state.returnOrder.stock >= action.quantity,
      );
      break;
    case 'reschedule_appointment':
      add('resource_found', action.resourceId === state.appointment.id);
      add(
        'slot_available',
        state.appointment.slots.some(
          (slot) => slot.id === action.slotId && slot.available && Date.parse(slot.startsAt) > now,
        ),
      );
      break;
    case 'recover_account':
      add('resource_found', action.resourceId === state.account.id);
      add(
        'recovery_rate_limit',
        state.account.recoveryRequests.filter((item) => now - Date.parse(item.createdAt) < 86400000)
          .length < policy.maxRecoveryPerDay,
      );
      break;
    case 'update_preferences':
    case 'privacy_request':
      add('resource_found', action.resourceId === state.customerId);
      break;
  }
  return checks;
}
export function needsConfirmation(action: WorkflowAction): boolean {
  return ['change_address', 'arrange_return', 'reschedule_appointment', 'privacy_request'].includes(
    action.kind,
  );
}
export function actionSummary(action: WorkflowAction): string {
  switch (action.kind) {
    case 'change_address':
      return 'Change this order’s delivery address.';
    case 'arrange_return':
      return `Arrange ${action.resolution} for ${action.quantity} item(s) on ${action.resourceId}.`;
    case 'reschedule_appointment':
      return 'Move the appointment to the customer’s confirmed time slot.';
    case 'recover_account':
      return 'Trigger the identity provider’s account recovery process; never reveal credentials.';
    case 'update_preferences':
      return `Set marketing email to ${action.marketingEmail ? 'on' : 'off'} and product updates to ${action.productUpdates ? 'on' : 'off'}.`;
    case 'privacy_request':
      return `Open a verified ${action.requestType} request for specialist review. No data is exported or deleted automatically.`;
  }
}
export function applyDemoAction(state: DemoState, action: WorkflowAction, id: string): void {
  switch (action.kind) {
    case 'change_address':
      state.order.address = action.address;
      break;
    case 'arrange_return':
      state.returnOrder.returned += action.quantity;
      if (action.resolution === 'replacement') state.returnOrder.stock -= action.quantity;
      state.returnOrder.returns.push({
        id,
        resolution: action.resolution,
        quantity: action.quantity,
      });
      break;
    case 'reschedule_appointment': {
      const selected = state.appointment.slots.find((slot) => slot.id === action.slotId);
      if (selected) selected.available = false;
      const previous = state.appointment.slots.find((slot) => slot.id === state.appointment.slotId);
      if (previous) previous.available = true;
      state.appointment.slotId = action.slotId;
      break;
    }
    case 'recover_account':
      state.account.recoveryRequests.push({ id, createdAt: new Date().toISOString() });
      break;
    case 'update_preferences':
      state.preferences.marketingEmail = action.marketingEmail;
      state.preferences.productUpdates = action.productUpdates;
      break;
    case 'privacy_request':
      state.privacyRequests.push({
        id,
        requestType: action.requestType,
        status: 'awaiting_specialist_review',
      });
      break;
  }
  state.version++;
}
