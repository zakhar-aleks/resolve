import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { SupportRun } from '@resolve/contracts';
@Entity('support_runs')
export class RunEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('text') caseId!: string;
  @Column('jsonb') result!: SupportRun;
  @Column('timestamptz') createdAt!: Date;
}
