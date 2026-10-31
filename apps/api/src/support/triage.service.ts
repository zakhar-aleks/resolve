import { WorkspaceRegistry } from '../tenancy/registry.service';
import { workspaceContext } from '../tenancy/context';
import { AccountWorkspaceEntity } from '../database/entities/account.entity';
import { HttpException } from '@nestjs/common';
import { PolicyContextService } from './prompts/policy-context.service';
import {
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { CaseEntity } from '../database/entities/case.entity';
import { SupportService } from './support.service';
import { PrivacyService } from '../privacy/privacy.service';
import { localSummary } from './helpers/summary';
@Injectable()
export class TriageService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: ReturnType<typeof setInterval> | undefined;
  private busy = false;
  private sweeping = false;
  private readonly progress = new Map<
    string,
    { lastRetention: number; lastPromptHash: string; recovered: boolean }
  >();
  private get progressState() {
    const id = workspaceContext.getStore()?.id ?? 'catalogue';
    let state = this.progress.get(id);
    if (!state) {
      state = { lastRetention: 0, lastPromptHash: '', recovered: false };
      this.progress.set(id, state);
    }
    return state;
  }
  constructor(
    private readonly data: DataSource,
    private readonly support: SupportService,
    private readonly privacy: PrivacyService,
    private readonly policies: PolicyContextService,
    private readonly registry: WorkspaceRegistry,
  ) {}
  async onApplicationBootstrap(): Promise<void> {
    await this.data
      .getRepository(CaseEntity)
      .update({ triageStatus: 'processing' }, { triageStatus: 'pending' });
    this.timer = setInterval(() => {
      void this.tick().catch(() => undefined);
    }, 1000);
    this.timer.unref();
  }
  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }
  async tick(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      await this.tickWorkspace();
      const workspaces = await this.registry.catalogue
        .getRepository(AccountWorkspaceEntity)
        .findBy({ ready: true });
      for (const workspace of workspaces) {
        try {
          const context = await this.registry.context(workspace, 'owner');
          await workspaceContext.run(context, () => this.tickWorkspace());
        } catch {
          /* One unavailable workspace must not prevent other queues from progressing. */
        }
      }
    } finally {
      this.sweeping = false;
    }
  }
  private async tickWorkspace(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      if (!this.progressState.recovered) {
        await this.data
          .getRepository(CaseEntity)
          .update({ triageStatus: 'processing' }, { triageStatus: 'pending' });
        this.progressState.recovered = true;
      }
      const snapshot = await this.policies.load();
      if (this.progressState.lastPromptHash !== snapshot.metadata.snapshotHash) {
        await this.data
          .getRepository(CaseEntity)
          .createQueryBuilder()
          .update()
          .set({ triageStatus: 'pending' })
          .where("status IN ('open','waiting') AND \"archivedAt\" IS NULL")
          .execute();
        this.progressState.lastPromptHash = snapshot.metadata.snapshotHash;
      }
      if (Date.now() - this.progressState.lastRetention > 60000) {
        await this.privacy.applyRetention();
        this.progressState.lastRetention = Date.now();
      }
      for (let i = 0; i < 6; i++) {
        const record = await this.data.transaction(async (manager) => {
          const value = await manager.findOne(CaseEntity, {
            where: { triageStatus: 'pending', archivedAt: IsNull() },
            order: { receivedAt: 'ASC' },
            lock: { mode: 'pessimistic_write', onLocked: 'skip_locked' },
          });
          if (!value) return null;
          value.triageStatus = 'processing';
          await manager.save(value);
          return value;
        });
        if (!record) break;
        if (record.status === 'resolved') {
          const intent = record.reason === 'cancel' ? 'cancel' : 'refund';
          await this.data
            .getRepository(CaseEntity)
            .update(record.id, { summary: localSummary(record, intent), triageStatus: 'ready' });
          continue;
        }
        try {
          await this.support.analyze(record.id, record.message);
        } catch (error) {
          if (error instanceof HttpException) {
            const body = error.getResponse();
            if (
              typeof body === 'object' &&
              body !== null &&
              'code' in body &&
              ['POLICY_CHANGED', 'ARCHIVED_REQUEST'].includes(String(body.code))
            )
              continue;
          }
          await this.data.getRepository(CaseEntity).update(record.id, {
            summary: localSummary(record, 'investigate'),
            triageStatus: 'review',
            tags: [...new Set([...record.tags, 'Needs review'])].slice(0, 8),
          });
        }
      }
    } finally {
      this.busy = false;
    }
  }
}
