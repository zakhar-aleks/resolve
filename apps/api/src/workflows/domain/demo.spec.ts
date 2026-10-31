import { describe, it, expect } from 'vitest';
import { DEFAULT_WORKFLOW_POLICY, type WorkflowAction } from '@resolve/contracts';
import { initialDemoState, demoChecks, applyDemoAction } from './demo';
import { connectorChecks } from './checks';
describe('non-payment action evidence', () => {
  it('blocks shipped orders and unverified ownership', () => {
    const state = initialDemoState();
    state.order.status = 'shipped';
    const action: WorkflowAction = {
      kind: 'change_address',
      resourceId: 'order_demo',
      address: state.order.address,
    };
    expect(
      demoChecks(state, action, DEFAULT_WORKFLOW_POLICY, false)
        .filter((check) => !check.passed)
        .map((check) => check.code),
    ).toEqual(['ownership_verified', 'order_unfulfilled']);
  });
  it('blocks replacement quantity, stock, time and value failures', () => {
    const state = initialDemoState();
    state.returnOrder.stock = 0;
    state.returnOrder.createdAt = '2020-01-01T00:00:00.000Z';
    const checks = demoChecks(
      state,
      {
        kind: 'arrange_return',
        resourceId: 'return_order_demo',
        itemId: 'item_demo',
        quantity: 3,
        resolution: 'replacement',
        reason: 'Damaged',
      },
      DEFAULT_WORKFLOW_POLICY,
      true,
    );
    expect(checks.filter((check) => !check.passed).map((check) => check.code)).toEqual([
      'eligible_quantity',
      'within_return_window',
      'value_limit',
      'stock_available',
    ]);
  });
  it('does not accept missing mandatory connector checks', () => {
    const checks = connectorChecks(
      { kind: 'recover_account', resourceId: 'account_demo' },
      [],
      true,
      true,
    );
    expect(checks.some((check) => !check.passed)).toBe(true);
  });
  it('reserves an appointment slot and releases the previous one', () => {
    const state = initialDemoState();
    applyDemoAction(
      state,
      { kind: 'reschedule_appointment', resourceId: 'appointment_demo', slotId: 'slot_morning' },
      'one',
    );
    expect(state.appointment.slots.find((slot) => slot.id === 'slot_morning')?.available).toBe(
      false,
    );
    applyDemoAction(
      state,
      { kind: 'reschedule_appointment', resourceId: 'appointment_demo', slotId: 'slot_afternoon' },
      'two',
    );
    expect(state.appointment.slots.find((slot) => slot.id === 'slot_morning')?.available).toBe(
      true,
    );
  });
  it('opens erasure review without deleting customer data', () => {
    const state = initialDemoState();
    applyDemoAction(
      state,
      { kind: 'privacy_request', resourceId: 'customer_demo', requestType: 'erasure' },
      'privacy',
    );
    expect(state.privacyRequests).toEqual([
      { id: 'privacy', requestType: 'erasure', status: 'awaiting_specialist_review' },
    ]);
    expect(state.order.address.line1).toBe('10 Example Street');
  });
});
