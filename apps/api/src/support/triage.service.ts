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
  private lastRetention = 0;
  private lastPromptHash = '';
  constructor(
    private readonly data: DataSource,
    private readonly support: SupportService,
    private readonly privacy: PrivacyService,
    private readonly policies: PolicyContextService,
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
    if (this.busy) return;
    this.busy = true;
    try {
      const snapshot = await this.policies.load();
      if (this.lastPromptHash !== snapshot.metadata.snapshotHash) {
        await this.data
          .getRepository(CaseEntity)
          .createQueryBuilder()
          .update()
          .set({ triageStatus: 'pending' })
          .where("status IN ('open','waiting') AND \"archivedAt\" IS NULL")
          .execute();
        this.lastPromptHash = snapshot.metadata.snapshotHash;
      }
      if (Date.now() - this.lastRetention > 60000) {
        await this.privacy.applyRetention();
        this.lastRetention = Date.now();
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
