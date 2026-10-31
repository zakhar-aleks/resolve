import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { SupportCase } from '@resolve/contracts';
@Entity('support_cases')
export class CaseEntity implements SupportCase {
  @PrimaryColumn('text') id!: string;
  @Column('text') name!: string;
  @Column('text') title!: string;
  @Column('text') message!: string;
  @Column('integer') amountCents!: number;
  @Column('integer') ageDays!: number;
  @Column('text') reason!: SupportCase['reason'];
  @Column('text') customerId!: string;
  @Column('text') paymentId!: string;
  @Column('integer', { default: 0 }) refundedCents!: number;
  @Column('text', { default: 'usd' }) currency!: 'usd';
  @Column('text', { default: 'simulator' }) provider!: SupportCase['provider'];
  @Column('text', { default: 'paid' }) paymentStatus!: string;
  @Column('text', { default: 'active' }) subscriptionStatus!: SupportCase['subscriptionStatus'];
}
