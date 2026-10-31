import type { BillingOperation } from '@resolve/contracts';
import type { OperationEntity } from '../../database/entities/operation.entity';
export function serializeOperation(op: OperationEntity): BillingOperation {
  return { ...op, createdAt: op.createdAt.toISOString() };
}
