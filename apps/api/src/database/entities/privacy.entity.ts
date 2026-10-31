import { encryptedColumn } from '../../security/encryption';
import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { PrivacyProfile } from '@resolve/contracts';
@Entity('privacy_settings')
export class PrivacyEntity {
  @PrimaryColumn('integer') id!: number;
  @Column('jsonb', { transformer: encryptedColumn('privacy_settings.profile') })
  profile!: PrivacyProfile;
}
