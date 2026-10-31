import { PolicyContextService } from './prompts/policy-context.service';
import { WorkflowKindSchema } from '@resolve/contracts';
import { WorkflowService } from '../workflows/workflow.service';
import { workflowIntent } from '../workflows/domain/intent';
import { SlackService } from '../slack/slack.service';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AppState } from '@resolve/contracts';
import { ConnectionsService } from '../connections/connections.service';
import { CaseEntity } from '../database/entities/case.entity';
import { RunEntity } from '../database/entities/run.entity';
import { EventEntity, OperationEntity } from '../database/entities/operation.entity';
import { serializeOperation } from '../billing/mappers/operation.mapper';
@Injectable()
export class StateService {
  constructor(
    private readonly data: DataSource,
    private readonly connections: ConnectionsService,
    private readonly slack: SlackService,
    private readonly workflows: WorkflowService,
    private readonly policies: PolicyContextService,
  ) {}
  async get(): Promise<AppState> {
    const snapshot = await this.policies.load();
    const [company, cases, runs, operations, events] = await Promise.all([
      Promise.resolve(snapshot.company),
      this.data.getRepository(CaseEntity).find({ order: { receivedAt: 'DESC', id: 'ASC' } }),
      this.data.getRepository(RunEntity).find({ order: { createdAt: 'DESC' }, take: 100 }),
      this.data.getRepository(OperationEntity).find({ order: { createdAt: 'DESC' }, take: 100 }),
      this.data.getRepository(EventEntity).find({ order: { createdAt: 'DESC' }, take: 50 }),
    ]);
    return {
      company,
      promptPreview: this.policies.preview(snapshot),
      workflows: await this.workflows.list('demo'),
      workflowPolicy: snapshot.workflows,
      demoService: await this.workflows.demoState(),
      privacy: snapshot.privacy,
      slack: this.slack.status(),
      cases: cases.map((record) => ({
        ...record,
        suggestedAction:
          WorkflowKindSchema.safeParse(
            runs.find(
              (run) =>
                run.caseId === record.id &&
                run.result.prompt?.snapshotHash === snapshot.metadata.snapshotHash,
            )?.result.routing?.scenario,
          ).data ?? workflowIntent(record.message),
      })),
      runs: runs.map((run) => run.result),
      operations: operations.map(serializeOperation),
      events: events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
      connections: this.connections.status(),
    };
  }
}
