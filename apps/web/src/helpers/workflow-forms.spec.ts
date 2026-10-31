import { it, expect } from 'vitest';
import { workflowForm } from './workflow-forms';
function form(kind: string) {
  const value = new FormData();
  value.set('kind', kind);
  value.set('idempotencyKey', 'b5c58cdc-2a89-4f9c-93c1-50222b457f3c');
  return value;
}
it('records unchecked optional communications as false', () => {
  const result = workflowForm(form('update_preferences'));
  expect(result.action).toEqual({
    kind: 'update_preferences',
    resourceId: 'customer_demo',
    marketingEmail: false,
    productUpdates: false,
  });
});
it('rejects fractional return quantities and unknown action kinds', () => {
  const input = form('arrange_return');
  input.set('quantity', '1.5');
  input.set('reason', 'Damaged');
  input.set('resolution', 'return');
  expect(() => workflowForm(input)).toThrow();
  expect(() => workflowForm(form('erase_everything'))).toThrow();
});
