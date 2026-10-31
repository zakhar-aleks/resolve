import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { IdentityProviderService } from './auth/identity.provider';
import { WorkspaceRegistry } from './tenancy/registry.service';
import { scopedDataSource } from './tenancy/context';
import { DataSource } from 'typeorm';
import { PolicyContextService } from './support/prompts/policy-context.service';
import { SupportOrchestrator } from './support/orchestration/support-orchestrator.service';
import { WorkflowService } from './workflows/workflow.service';
import { WorkflowBootstrapService } from './workflows/workflow-bootstrap.service';
import { WorkflowController, AgentController } from './workflows/workflow.controller';
import { ConnectorProvider } from './workflows/providers/connector.provider';
import { AgentKeyGuard } from './workflows/guards/agent-key.guard';
import { IntakeController } from './support/intake.controller';
import { PrivacyService } from './privacy/privacy.service';
import { PrivacyController } from './privacy/privacy.controller';
import { SlackService } from './slack/slack.service';
import { TriageService } from './support/triage.service';
import { CaseManagementService } from './support/case-management.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseOptions } from './database/data-source';
import { BootstrapService } from './database/bootstrap.service';
import { CompanyController } from './company/company.controller';
import { CompanyService } from './company/company.service';
import { ConnectionsController } from './connections/connections.controller';
import { ConnectionsService } from './connections/connections.service';
import { SupportController } from './support/support.controller';
import { SupportService } from './support/support.service';
import { StateController } from './support/state.controller';
import { StateService } from './support/state.service';
import { MistralProvider } from './support/providers/mistral.provider';
import { JevProvider } from './support/providers/jev.provider';
import { BillingController } from './billing/billing.controller';
import { BillingService } from './billing/billing.service';
import { StripeProvider } from './billing/stripe.provider';
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => databaseOptions,
      dataSourceFactory: async () =>
        scopedDataSource(await new DataSource(databaseOptions).initialize()),
    }),
    TypeOrmModule.forFeature(databaseOptions.entities),
  ],
  controllers: [
    AuthController,
    CompanyController,
    ConnectionsController,
    SupportController,
    StateController,
    BillingController,
    PrivacyController,
    IntakeController,
    WorkflowController,
    AgentController,
  ],
  providers: [
    AuthService,
    IdentityProviderService,
    WorkspaceRegistry,
    BootstrapService,
    CompanyService,
    ConnectionsService,
    SupportService,
    PolicyContextService,
    SupportOrchestrator,
    StateService,
    MistralProvider,
    JevProvider,
    BillingService,
    StripeProvider,
    PrivacyService,
    SlackService,
    TriageService,
    CaseManagementService,
    WorkflowService,
    WorkflowBootstrapService,
    ConnectorProvider,
    AgentKeyGuard,
  ],
})
export class AppModule {}
