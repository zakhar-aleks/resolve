import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type { CreateCaseInput, SupportCase, SupportRun } from '@resolve/contracts';
import { CaseEntity } from '../database/entities/case.entity';
import { RunEntity } from '../database/entities/run.entity';
import { StripeProvider } from '../billing/stripe.provider';
import { PolicyContextService } from './prompts/policy-context.service';
import { SupportOrchestrator } from './orchestration/support-orchestrator.service';
import { suggestedTags } from './helpers/summary';
import { conflict } from '../common/errors';
@Injectable()
export class SupportService {
  constructor(
    private readonly data: DataSource,
    private readonly stripe: StripeProvider,
    private readonly policies: PolicyContextService,
    private readonly orchestrator: SupportOrchestrator,
  ) {}
  async create(input: CreateCaseInput): Promise<SupportCase> {
    const id = `custom_${randomUUID()}`;
    const cases = this.data.getRepository(CaseEntity);
    return cases.save(
      cases.create({
        ...input,
        id,
        customerId: `cus_${id}`,
        paymentId: `pi_${id}`,
        refundedCents: 0,
        currency: 'usd',
        provider: 'simulator',
        paymentStatus: 'paid',
        subscriptionStatus: 'active',
      }),
    );
  }
  async analyze(caseId: string, message: string): Promise<SupportRun> {
    const started = performance.now();
    const stored = await this.data.getRepository(CaseEntity).findOneByOrFail({ id: caseId });
    if (stored.archivedAt) conflict('ARCHIVED_REQUEST');
    const record = stored.provider === 'stripe' ? await this.stripe.readPayment(stored) : stored;
    const snapshot = await this.policies.load();
    const prepared = await this.orchestrator.prepare(message, record, snapshot);
    const result: SupportRun = {
      ...prepared,
      prompt: snapshot.metadata,
      privacyRevision: snapshot.privacy.revision,
      id: randomUUID(),
      caseId,
      message,
      company: snapshot.company,
      amountCents: record.amountCents - record.refundedCents,
      elapsedMs: Math.round(performance.now() - started),
      createdAt: new Date().toISOString(),
    };
    const status = await this.data.transaction(async (manager) => {
      const current = await this.policies.within(manager);
      const locked = await manager.findOneOrFail(CaseEntity, {
        where: { id: caseId },
        lock: { mode: 'pessimistic_write' },
      });
      if (locked.archivedAt) return 'archived';
      if (
        current.metadata.snapshotHash !== snapshot.metadata.snapshotHash ||
        locked.aiPreference !== stored.aiPreference ||
        locked.message !== stored.message ||
        locked.status !== stored.status
      ) {
        if (locked.status !== 'resolved') {
          locked.triageStatus = 'pending';
          await manager.save(locked);
        }
        return 'stale';
      }
      await manager.save(RunEntity, {
        id: result.id,
        caseId,
        result,
        createdAt: new Date(result.createdAt),
      });
      locked.summary = result.analysis.summary;
      locked.triageStatus = ['review', 'request_info'].includes(result.decision.action)
        ? 'review'
        : 'ready';
      locked.tags = [
        ...new Set([...locked.tags, ...suggestedTags(record, result.analysis.intent)]),
      ].slice(0, 8);
      await manager.save(locked);
      return 'accepted';
    });
    if (status !== 'accepted')
      conflict(status === 'archived' ? 'ARCHIVED_REQUEST' : 'POLICY_CHANGED');
    return result;
  }
}
