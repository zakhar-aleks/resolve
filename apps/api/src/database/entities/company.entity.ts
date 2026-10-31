import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { CompanyProfile } from '@resolve/contracts';
@Entity('companies')
export class CompanyEntity {
  @PrimaryColumn('integer') id!: number;
  @Column('jsonb') profile!: CompanyProfile;
}
