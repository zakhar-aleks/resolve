import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { ActionEvent, BillingOperation, Receipt } from '@resolve/contracts';
@Entity('billing_operations')
export class OperationEntity {
  @PrimaryColumn('uuid') id!: string;
  @Index({ unique: true }) @Column('uuid') runId!: string;
  @Column('text') caseId!: string;
  @Column('text') action!: BillingOperation['action'];
  @Column('text') state!: BillingOperation['state'];
  @Column('integer') amountCents!: number;
  @Column('jsonb', { nullable: true }) receipt!: Receipt | null;
  @Column('timestamptz') createdAt!: Date;
}
@Entity('action_events')
export class EventEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') operationId!: string;
  @Column('text') state!: ActionEvent['state'];
  @Column('text') code!: ActionEvent['code'];
  @Column('timestamptz') createdAt!: Date;
}
