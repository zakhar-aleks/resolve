import { Accounts1793461000000 } from './migrations/accounts';
import {
  AccountApiKeyEntity,
  AccountUserEntity,
  AccountWorkspaceEntity,
  MembershipEntity,
  SessionEntity,
  OAuthFlowEntity,
  InviteEntity,
  WorkspaceCredentialEntity,
} from './entities/account.entity';
import { EncryptedContent1793460000000 } from './migrations/encrypted-content';
import { PolicyPrompts1793458800000 } from './migrations/policy-prompts';
import 'reflect-metadata';
import {
  WorkflowEntity,
  WorkflowSettingsEntity,
  DemoServiceEntity,
} from './entities/workflow.entity';
import { AgentWorkflows1793451600000 } from './migrations/agent-workflows';
import { DataSource } from 'typeorm';
import { environment } from '../config/environment';
import { CompanyEntity } from './entities/company.entity';
import { CaseEntity } from './entities/case.entity';
import { RunEntity } from './entities/run.entity';
import { OperationEntity, EventEntity } from './entities/operation.entity';
import { PrivacyEntity } from './entities/privacy.entity';
import { SupportExperience1793444400000 } from './migrations/support-experience';
import { Initial1793440800000 } from './migrations/initial';
export const databaseOptions = {
  type: 'postgres' as const,
  ...(environment.DATABASE_SSL === 'true'
    ? {
        ssl: {
          rejectUnauthorized: true,
          ...(environment.DATABASE_CA_CERT
            ? { ca: environment.DATABASE_CA_CERT.replaceAll('\\n', '\n') }
            : {}),
        },
      }
    : {}),
  url: environment.DATABASE_URL,
  entities: [
    AccountApiKeyEntity,
    AccountUserEntity,
    AccountWorkspaceEntity,
    MembershipEntity,
    SessionEntity,
    OAuthFlowEntity,
    InviteEntity,
    WorkspaceCredentialEntity,
    CompanyEntity,
    CaseEntity,
    RunEntity,
    OperationEntity,
    EventEntity,
    PrivacyEntity,
    WorkflowEntity,
    WorkflowSettingsEntity,
    DemoServiceEntity,
  ],
  migrations: [
    Initial1793440800000,
    SupportExperience1793444400000,
    AgentWorkflows1793451600000,
    PolicyPrompts1793458800000,
    EncryptedContent1793460000000,
    Accounts1793461000000,
  ],
  migrationsRun: true,
  synchronize: false,
  retryAttempts: 1,
  logging: false,
};
export default new DataSource(databaseOptions);
