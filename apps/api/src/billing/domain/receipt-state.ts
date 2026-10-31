import type { Receipt, OperationState } from '@resolve/contracts';
export function receiptState(receipt: Receipt): OperationState {
  if (receipt.status === 'cancel_at_period_end') return 'succeeded';
  if (
    receipt.status === 'succeeded' ||
    receipt.status === 'pending' ||
    receipt.status === 'failed' ||
    receipt.status === 'canceled'
  )
    return receipt.status;
  return 'unknown';
}
