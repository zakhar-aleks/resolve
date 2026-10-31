import { encryptedColumn } from '../../security/encryption';
import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { CompanyProfile } from '@resolve/contracts';
@Entity('companies')
export class CompanyEntity {
  @PrimaryColumn('integer') id!: number;
  @Column('jsonb', { transformer: encryptedColumn('companies.profile') }) profile!: CompanyProfile;
}
