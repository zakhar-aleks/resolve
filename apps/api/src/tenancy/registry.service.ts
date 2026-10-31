import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { DEFAULT_COMPANY, DEFAULT_PRIVACY, DEFAULT_WORKFLOW_POLICY } from '@resolve/contracts';
import { databaseOptions } from '../database/data-source';
import {
  AccountWorkspaceEntity,
  WorkspaceCredentialEntity,
} from '../database/entities/account.entity';
import { CompanyEntity } from '../database/entities/company.entity';
import { PrivacyEntity } from '../database/entities/privacy.entity';
import { DemoServiceEntity, WorkflowSettingsEntity } from '../database/entities/workflow.entity';
import { initialDemoState } from '../workflows/domain/demo';
import { catalogueDataSource, workspaceContext, type WorkspaceContext } from './context';
@Injectable()
export class WorkspaceRegistry implements OnApplicationShutdown {
  readonly catalogue: DataSource;
  private readonly pools = new Map<string, Promise<DataSource>>();
  constructor(data: DataSource) {
    this.catalogue = catalogueDataSource(data);
  }
  async source(workspace: AccountWorkspaceEntity): Promise<DataSource> {
    let pending = this.pools.get(workspace.id);
    if (!pending) {
      const url = new URL(databaseOptions.url);
      url.pathname = `/${workspace.databaseName}`;
      const data = new DataSource({ ...databaseOptions, url: url.href, extra: { max: 2 } });
      pending = workspaceContext.run({ id: workspace.id, data, secrets: {}, role: 'owner' }, () =>
        data.initialize(),
      );
      this.pools.set(workspace.id, pending);
      void pending.catch(() => this.pools.delete(workspace.id));
    }
    return pending;
  }
  async context(
    workspace: AccountWorkspaceEntity,
    role: WorkspaceContext['role'],
    userId?: string,
  ): Promise<WorkspaceContext> {
    const data = await this.source(workspace);
    return workspaceContext.run({ id: workspace.id, data, secrets: {}, role }, async () => {
      const credentials = await data.getRepository(WorkspaceCredentialEntity).find();
      return {
        id: workspace.id,
        data,
        secrets: Object.fromEntries(credentials.map((row) => [row.id, row.value])),
        role,
        ...(userId ? { userId } : {}),
      };
    });
  }
  async provision(workspace: AccountWorkspaceEntity, companyName: string): Promise<void> {
    if (!/^resolve_t_[a-f0-9]{32}$/u.test(workspace.databaseName))
      throw new Error('Invalid database name');
    const existing = (await this.catalogue.query('SELECT 1 FROM pg_database WHERE datname=$1', [
      workspace.databaseName,
    ])) as unknown[];
    if (!existing.length) await this.catalogue.query(`CREATE DATABASE "${workspace.databaseName}"`);
    const context = await this.context(workspace, 'owner');
    await workspaceContext.run(context, () =>
      context.data.transaction(async (manager) => {
        await manager.upsert(
          CompanyEntity,
          { id: 1, profile: { ...DEFAULT_COMPANY, companyName, revision: randomUUID() } },
          ['id'],
        );
        await manager.upsert(
          PrivacyEntity,
          { id: 1, profile: { ...DEFAULT_PRIVACY, revision: randomUUID(), aiEnabled: false } },
          ['id'],
        );
        await manager.upsert(
          WorkflowSettingsEntity,
          { id: 1, policy: { ...DEFAULT_WORKFLOW_POLICY, revision: randomUUID() } },
          ['id'],
        );
        if (!(await manager.exists(DemoServiceEntity, { where: { id: 1 } })))
          await manager.save(DemoServiceEntity, { id: 1, state: initialDemoState() });
      }),
    );
    workspace.ready = true;
    await this.catalogue.getRepository(AccountWorkspaceEntity).save(workspace);
  }
  async onApplicationShutdown(): Promise<void> {
    for (const pending of this.pools.values()) {
      const source = await pending.catch(() => null);
      if (source?.isInitialized) await source.destroy();
    }
  }
}
