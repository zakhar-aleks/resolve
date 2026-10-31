import type { WorkflowAction, Workflow } from '@resolve/contracts';
const required: Record<WorkflowAction['kind'], string[]> = {
  change_address: ['resource_found', 'order_unfulfilled'],
  arrange_return: [
    'order_delivered',
    'resource_found',
    'eligible_quantity',
    'within_return_window',
    'value_limit',
    'stock_available',
  ],
  reschedule_appointment: ['resource_found', 'slot_available'],
  recover_account: ['resource_found', 'recovery_rate_limit'],
  update_preferences: ['resource_found'],
  privacy_request: ['resource_found'],
};
export function connectorChecks(
  action: WorkflowAction,
  checks: Workflow['checks'],
  ownership: boolean,
  enabled: boolean,
): Workflow['checks'] {
  return [
    { code: 'ownership_verified', passed: ownership },
    { code: 'action_permitted', passed: enabled },
    ...required[action.kind].map((code) => ({
      code,
      passed: checks.some((check) => check.code === code && check.passed),
    })),
    ...checks.filter(
      (check) =>
        !['ownership_verified', 'action_permitted', ...required[action.kind]].includes(check.code),
    ),
  ];
}
