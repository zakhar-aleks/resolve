import { encryptedColumn } from '../../security/encryption';
import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { SupportCase } from '@resolve/contracts';
@Entity('support_cases')
export class CaseEntity implements SupportCase {
  @PrimaryColumn('text') id!: string;
  @Column('text', { transformer: encryptedColumn('support_cases.name') }) name!: string;
  @Column('text', { transformer: encryptedColumn('support_cases.title') }) title!: string;
  @Column('text', { transformer: encryptedColumn('support_cases.message') }) message!: string;
  @Column('integer') amountCents!: number;
  @Column('integer') ageDays!: number;
  @Column('text') reason!: SupportCase['reason'];
  @Column('text', { transformer: encryptedColumn('support_cases.customerId') }) customerId!: string;
  @Column('text') paymentId!: string;
  @Column('integer', { default: 0 }) refundedCents!: number;
  @Column('text', { default: 'usd' }) currency!: 'usd';
  @Column('text', { default: 'simulator' }) provider!: SupportCase['provider'];
  @Column('text', { default: 'paid' }) paymentStatus!: string;
  @Column('text', { default: 'active' }) subscriptionStatus!: SupportCase['subscriptionStatus'];
  @Column('text', { default: '', transformer: encryptedColumn('support_cases.summary') }) summary =
    '';
  @Column('text', { default: 'pending' }) triageStatus: SupportCase['triageStatus'] = 'pending';
  @Column('jsonb', { transformer: encryptedColumn('support_cases.tags') }) tags: string[] = [];
  @Column('text', { default: '', transformer: encryptedColumn('support_cases.assignee') })
  assignee = '';
  @Column('text', { default: 'workspace' }) channel: SupportCase['channel'] = 'workspace';
  @Column('text', { nullable: true, unique: true }) externalId: string | null = null;
  @Column('text', { default: 'allowed' }) aiPreference: SupportCase['aiPreference'] = 'allowed';
  @Column('timestamptz', {
    default: () => 'CURRENT_TIMESTAMP',
    transformer: {
      to: (value: string | undefined) => (value === undefined ? undefined : new Date(value)),
      from: (value: Date) => value.toISOString(),
    },
  })
  receivedAt = new Date().toISOString();
  @Column('timestamptz', {
    nullable: true,
    transformer: {
      to: (value: string | null) => (value ? new Date(value) : null),
      from: (value: Date | null) => value?.toISOString() ?? null,
    },
  })
  closedAt: string | null = null;
  @Column('timestamptz', {
    nullable: true,
    transformer: {
      to: (value: string | null) => (value ? new Date(value) : null),
      from: (value: Date | null) => value?.toISOString() ?? null,
    },
  })
  archivedAt: string | null = null;
  @Column('text', { default: 'open' }) status: SupportCase['status'] = 'open';
}
