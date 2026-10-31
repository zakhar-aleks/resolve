import { PolicyContextService } from '../support/prompts/policy-context.service';
import { agentApiSchema } from './domain/api-schema';
import { Body, Controller, Get, Param, Post, Put, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import {
  WorkflowCreateSchema,
  WorkflowConfirmationSchema,
  WorkflowExecutionSchema,
  WorkflowPolicySchema,
  AgentMessageSchema,
  type WorkflowCreate,
  type WorkflowPolicy,
  type IntakeInput,
} from '@resolve/contracts';
import { SchemaPipe } from '../common/pipes/schema.pipe';
import { CaseManagementService } from '../support/case-management.service';
import { WorkflowService, type WorkflowAccess } from './workflow.service';
import { AgentKeyGuard } from './guards/agent-key.guard';
import { workflowIntent } from './domain/intent';
@Controller('workflows')
export class WorkflowController {
  protected readonly access: WorkflowAccess = 'demo';
  constructor(
    protected readonly workflows: WorkflowService,
    protected readonly management: CaseManagementService,
    protected readonly policies: PolicyContextService,
  ) {}
  @Get('prompt') async promptPreview() {
    return this.policies.preview(await this.policies.load());
  }
  @Get('schema') schema() {
    return agentApiSchema();
  }
  @Get('capabilities') capabilities() {
    return this.workflows.capabilities();
  }
  @Get('policy') policy() {
    return this.workflows.policy();
  }
  @Put('policy') savePolicy(@Body(new SchemaPipe(WorkflowPolicySchema)) input: WorkflowPolicy) {
    return this.workflows.savePolicy(input, this.access);
  }
  @Get('demo') demo() {
    return this.workflows.demoState();
  }
  @Get('requests') list() {
    return this.workflows.list(this.access);
  }
  @Get('requests/:id') get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.workflows.get(id, this.access);
  }
  @Post('messages') async message(@Body(new SchemaPipe(AgentMessageSchema)) input: IntakeInput) {
    return {
      ...(await this.management.intake(input)),
      suggestedAction: workflowIntent(input.message),
    };
  }
  @Post('requests') prepare(@Body(new SchemaPipe(WorkflowCreateSchema)) input: WorkflowCreate) {
    return this.workflows.prepare(input, this.access);
  }
  @Post('requests/:id/confirm') confirm(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new SchemaPipe(WorkflowConfirmationSchema))
    input: { planHash: string; verificationToken: string },
  ) {
    return this.workflows.confirm(id, input.planHash, input.verificationToken, this.access);
  }
  @Post('requests/:id/execute') execute(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new SchemaPipe(WorkflowExecutionSchema)) input: { planHash: string },
  ) {
    return this.workflows.execute(id, input.planHash, this.access);
  }
  @Post('requests/:id/reconcile') reconcile(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.workflows.reconcile(id, this.access);
  }
}
@Controller('v1/agent')
@UseGuards(AgentKeyGuard)
export class AgentController extends WorkflowController {
  protected override readonly access: WorkflowAccess = 'api';
  constructor(
    workflows: WorkflowService,
    management: CaseManagementService,
    policies: PolicyContextService,
  ) {
    super(workflows, management, policies);
  }
}
