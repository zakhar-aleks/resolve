import type { WorkflowKind } from '@resolve/contracts';
export function workflowIntent(message: string): WorkflowKind | null {
  if (/address|delivery details/iu.test(message)) return 'change_address';
  if (/return|replace|replacement|damaged/iu.test(message)) return 'arrange_return';
  if (/appointment|reschedule|booking/iu.test(message)) return 'reschedule_appointment';
  if (/password|sign.?in|log.?in|recovery|locked out/iu.test(message)) return 'recover_account';
  if (/unsubscribe|notification|marketing|newsletter/iu.test(message)) return 'update_preferences';
  if (
    /erase|delete my data|data export|personal data|privacy request|access my data/iu.test(message)
  )
    return 'privacy_request';
  return null;
}
