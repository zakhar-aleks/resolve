import { PrivacyService } from '../privacy/privacy.service';
import { SlackService } from '../slack/slack.service';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AppState } from '@resolve/contracts';
import { CompanyService } from '../company/company.service';
import { ConnectionsService } from '../connections/connections.service';
import { CaseEntity } from '../database/entities/case.entity';
import { RunEntity } from '../database/entities/run.entity';
import { EventEntity, OperationEntity } from '../database/entities/operation.entity';
import { serializeOperation } from '../billing/mappers/operation.mapper';
@Injectable()
export class StateService {
  constructor(
    private readonly data: DataSource,
    private readonly company: CompanyService,
    private readonly connections: ConnectionsService,
    private readonly privacy: PrivacyService,
    private readonly slack: SlackService,
  ) {}
  async get(): Promise<AppState> {
    const [company, cases, runs, operations, events] = await Promise.all([
      this.company.get(),
      this.data.getRepository(CaseEntity).find({ order: { receivedAt: 'DESC', id: 'ASC' } }),
      this.data.getRepository(RunEntity).find({ order: { createdAt: 'DESC' }, take: 100 }),
      this.data.getRepository(OperationEntity).find({ order: { createdAt: 'DESC' }, take: 100 }),
      this.data.getRepository(EventEntity).find({ order: { createdAt: 'DESC' }, take: 50 }),
    ]);
    return {
      company,
      privacy: await this.privacy.get(),
      slack: this.slack.status(),
      cases,
      runs: runs.map((run) => run.result),
      operations: operations.map(serializeOperation),
      events: events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
      connections: this.connections.status(),
    };
  }
}
