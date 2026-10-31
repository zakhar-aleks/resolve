import { Column, Entity, PrimaryColumn } from 'typeorm';
import { encryptedColumn } from '../../security/encryption';
@Entity('account_users')
export class AccountUserEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('text', { unique: true }) identityHash!: string;
  @Column('text', { transformer: encryptedColumn('account_users.email') }) email!: string;
  @Column('text') emailHash!: string;
  @Column('text') provider!: string;
  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;
  @Column('text', { nullable: true }) privacyVersion!: string | null;
  @Column('text', { nullable: true }) termsVersion!: string | null;
  @Column('timestamptz', { nullable: true }) termsAcceptedAt!: Date | null;
}
@Entity('account_workspaces')
export class AccountWorkspaceEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('text', { unique: true }) databaseName!: string;
  @Column('boolean', { default: false }) ready = false;
}
@Entity('account_memberships')
export class MembershipEntity {
  @PrimaryColumn('uuid') userId!: string;
  @PrimaryColumn('uuid') workspaceId!: string;
  @Column('text') role!: 'owner' | 'agent' | 'reviewer';
}
@Entity('account_sessions')
export class SessionEntity {
  @PrimaryColumn('text') hash!: string;
  @Column('uuid') userId!: string;
  @Column('uuid', { nullable: true }) workspaceId!: string | null;
  @Column('timestamptz') expiresAt!: Date;
}
@Entity('account_flows')
export class OAuthFlowEntity {
  @PrimaryColumn('text') stateHash!: string;
  @Column('text') browserHash!: string;
  @Column('text') provider!: string;
  @Column('text', { transformer: encryptedColumn('account_flows.secret') }) secret!: string;
  @Column('timestamptz') expiresAt!: Date;
}
@Entity('account_invites')
export class InviteEntity {
  @PrimaryColumn('text') hash!: string;
  @Column('uuid') workspaceId!: string;
  @Column('uuid') createdBy!: string;
  @Column('text') emailHash!: string;
  @Column('text') role!: 'agent' | 'reviewer';
  @Column('timestamptz') expiresAt!: Date;
}
@Entity('workspace_credentials')
export class WorkspaceCredentialEntity {
  @PrimaryColumn('text') id!: string;
  @Column('text', { transformer: encryptedColumn('workspace_credentials.value') }) value!: string;
}

@Entity('account_api_keys')
export class AccountApiKeyEntity {
  @PrimaryColumn('text') hash!: string;
  @Column('uuid') workspaceId!: string;
  @Column('text') role!: 'intake' | 'reviewer';
}
