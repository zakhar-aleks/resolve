import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DEFAULT_WORKFLOW_POLICY } from '@resolve/contracts';
import { DemoServiceEntity, WorkflowSettingsEntity } from '../database/entities/workflow.entity';
import { initialDemoState } from './domain/demo';
@Injectable()
export class WorkflowBootstrapService implements OnApplicationBootstrap {
  constructor(private readonly data: DataSource) {}
  async onApplicationBootstrap(): Promise<void> {
    await this.data
      .createQueryBuilder()
      .insert()
      .into(WorkflowSettingsEntity)
      .values({ id: 1, policy: DEFAULT_WORKFLOW_POLICY })
      .orIgnore()
      .execute();
    await this.data
      .createQueryBuilder()
      .insert()
      .into(DemoServiceEntity)
      .values({ id: 1, state: initialDemoState() })
      .orIgnore()
      .execute();
  }
}
