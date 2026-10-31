import { Injectable } from '@nestjs/common';
import { DataSource, In, IsNull, LessThan } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type { PrivacyProfile } from '@resolve/contracts';
import { PrivacyEntity } from '../database/entities/privacy.entity';
import { CaseEntity } from '../database/entities/case.entity';
import { RunEntity } from '../database/entities/run.entity';
import { OperationEntity } from '../database/entities/operation.entity';
import { conflict, invalid } from '../common/errors';
@Injectable()
export class PrivacyService {
  constructor(private readonly data: DataSource) {}
  async get(): Promise<PrivacyProfile> {
    return (await this.data.getRepository(PrivacyEntity).findOneByOrFail({ id: 1 })).profile;
  }
  async update(input: PrivacyProfile): Promise<PrivacyProfile> {
    if (
      input.aiEnabled &&
      (!input.legalName.trim() ||
        !input.privacyEmail ||
        input.lawfulBasis === 'undecided' ||
        !input.tasks.some((task) => task.id === 'processors' && task.confirmed))
    )
      invalid('PRIVACY_SETUP_REQUIRED');
    return this.data.transaction(async (manager) => {
      const entity = await manager.findOneOrFail(PrivacyEntity, {
        where: { id: 1 },
        lock: { mode: 'pessimistic_write' },
      });
      if (entity.profile.revision !== input.revision) conflict('STALE_SETTINGS');
      entity.profile = { ...input, revision: randomUUID() };
      await manager.save(entity);
      await manager.update(
        CaseEntity,
        { status: In(['open', 'waiting']), archivedAt: IsNull() },
        { triageStatus: 'pending' },
      );
      return entity.profile;
    });
  }
  async applyRetention(): Promise<{ archived: number }> {
    const profile = await this.get();
    const cutoff = new Date(Date.now() - profile.retentionDays * 86400000).toISOString();
    return this.data.transaction(async (manager) => {
      const cases = await manager.find(CaseEntity, {
        where: { status: 'resolved', closedAt: LessThan(cutoff), archivedAt: IsNull() },
        take: 50,
        lock: { mode: 'pessimistic_write', onLocked: 'skip_locked' },
      });
      let archived = 0;
      for (const record of cases) {
        if (
          await manager.exists(OperationEntity, {
            where: { caseId: record.id, state: In(['dispatched', 'unknown', 'pending']) },
          })
        )
          continue;
        record.name = 'Customer';
        record.title = 'Archived request';
        record.message = 'Content removed under retention policy.';
        record.summary = record.message;
        record.customerId = '';
        record.paymentId = `archived_${record.id}`;
        record.tags = [];
        record.assignee = '';
        record.archivedAt = new Date().toISOString();
        record.triageStatus = 'review';
        await manager.save(record);
        const runs = await manager.findBy(RunEntity, { caseId: record.id });
        for (const run of runs) {
          run.result.message = record.message;
          run.result.analysis.summary = record.message;
          run.result.decision.reply = '';
          run.result.decision.rationale = '';
          await manager.save(run);
        }
        archived++;
      }
      return { archived };
    });
  }
}
