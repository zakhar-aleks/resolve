import { PolicyContextService } from '../support/prompts/policy-context.service';
import { serializeOperation } from './mappers/operation.mapper';
import { receiptState } from './domain/receipt-state';
import { PrivacyEntity } from '../database/entities/privacy.entity';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { In, type EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type {
  ActionEvent,
  BillingOperation,
  OperationState,
  Receipt,
  SupportCase,
} from '@resolve/contracts';
import { CompanyEntity } from '../database/entities/company.entity';
import { CaseEntity } from '../database/entities/case.entity';
import { RunEntity } from '../database/entities/run.entity';
import { EventEntity, OperationEntity } from '../database/entities/operation.entity';
import { approvalFailure } from '../support/domain/policy';
import { conflict } from '../common/errors';
import { StripeProvider } from './stripe.provider';
const TERMINAL: readonly OperationState[] = ['succeeded', 'failed', 'canceled'];
@Injectable()
export class BillingService {
  constructor(
    private readonly data: DataSource,
    private readonly stripe: StripeProvider,
    private readonly policies: PolicyContextService,
  ) {}
  private async event(
    manager: EntityManager,
    op: OperationEntity,
    code: ActionEvent['code'],
  ): Promise<void> {
    await manager.save(EventEntity, {
      id: randomUUID(),
      operationId: op.id,
      state: op.state,
      code,
      createdAt: new Date(),
    });
  }
  private async prepare(
    runId: string,
    remote: SupportCase | null,
  ): Promise<{ operation: BillingOperation; dispatch: boolean }> {
    return this.data.transaction(async (manager) => {
      const run = await manager.findOneByOrFail(RunEntity, { id: runId });
      const snapshot = await this.policies.within(manager);
      const company = await manager.findOneOrFail(CompanyEntity, {
        where: { id: 1 },
        lock: { mode: 'pessimistic_read' },
      });
      const privacy = await manager.findOneOrFail(PrivacyEntity, {
        where: { id: 1 },
        lock: { mode: 'pessimistic_read' },
      });
      const locked = await manager.findOneOrFail(CaseEntity, {
        where: { id: run.caseId },
        lock: { mode: 'pessimistic_write' },
      });
      const previous = await manager.findOneBy(OperationEntity, { runId });
      if (previous) return { operation: serializeOperation(previous), dispatch: false };
      const record = remote ?? locked;
      if (locked.triageStatus !== 'ready') conflict('POLICY_CHANGED');
      if (run.result.prompt?.snapshotHash !== snapshot.metadata.snapshotHash)
        conflict('POLICY_CHANGED');
      if (run.result.privacyRevision !== privacy.profile.revision) conflict('POLICY_CHANGED');
      if (locked.aiPreference === 'human_only' && run.result.analysis.source !== 'rules')
        conflict('POLICY_CHANGED');
      const failure = approvalFailure(run.result, company.profile, record, new Date());
      if (failure) conflict(failure);
      const unresolved = await manager.findOneBy(OperationEntity, {
        caseId: locked.id,
        state: In(['dispatched', 'unknown', 'pending']),
      });
      if (unresolved) conflict('UNRESOLVED_OPERATION');
      const action = run.result.decision.action;
      if (action !== 'refund' && action !== 'cancel') conflict('ACTION_NOT_AUTHORIZED');
      const op = manager.create(OperationEntity, {
        id: randomUUID(),
        runId,
        caseId: locked.id,
        action,
        state: 'dispatched',
        amountCents: run.result.amountCents,
        receipt: null,
        createdAt: new Date(),
      });
      await manager.save(op);
      await this.event(manager, op, 'prepared');
      return { operation: serializeOperation(op), dispatch: true };
    });
  }
  private async recordOutcome(
    id: string,
    state: OperationState,
    receipt: Receipt | null,
    code: ActionEvent['code'],
  ): Promise<BillingOperation> {
    return this.data.transaction(async (manager) => {
      const op = await manager.findOneOrFail(OperationEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (TERMINAL.includes(op.state)) return serializeOperation(op);
      if (state === 'succeeded')
        await manager.update(
          CaseEntity,
          { id: op.caseId },
          { status: 'resolved', closedAt: new Date().toISOString() },
        );
      op.state = state;
      op.receipt = receipt;
      await manager.save(op);
      await this.event(manager, op, code);
      return serializeOperation(op);
    });
  }
  async execute(runId: string): Promise<BillingOperation> {
    const storedRun = await this.data.getRepository(RunEntity).findOneByOrFail({ id: runId });
    const stored = await this.data
      .getRepository(CaseEntity)
      .findOneByOrFail({ id: storedRun.caseId });
    const remote = stored.provider === 'stripe' ? await this.stripe.readPayment(stored) : null;
    const prepared = await this.prepare(runId, remote);
    if (!prepared.dispatch) return prepared.operation;
    const op = prepared.operation;
    if (stored.provider === 'simulator') {
      return this.data.transaction(async (manager) => {
        const entity = await manager.findOneOrFail(OperationEntity, {
          where: { id: op.id },
          lock: { mode: 'pessimistic_write' },
        });
        const record = await manager.findOneOrFail(CaseEntity, {
          where: { id: op.caseId },
          lock: { mode: 'pessimistic_write' },
        });
        if (op.action === 'refund') record.refundedCents += op.amountCents;
        else record.subscriptionStatus = 'cancel_at_period_end';
        await manager.save(record);
        entity.receipt = {
          id: `sim_${op.id}`,
          status: op.action === 'refund' ? 'succeeded' : 'cancel_at_period_end',
          provider: 'simulator',
          amountCents: op.action === 'refund' ? op.amountCents : null,
        };
        entity.state = record.id === 'timeout' ? 'unknown' : 'succeeded';
        if (entity.state === 'succeeded') {
          record.status = 'resolved';
          record.closedAt = new Date().toISOString();
          await manager.save(record);
        }
        await manager.save(entity);
        await this.event(
          manager,
          entity,
          entity.state === 'unknown' ? 'response_lost' : 'committed',
        );
        return serializeOperation(entity);
      });
    }
    try {
      const receipt = await this.stripe.refund(remote ?? stored, op);
      return this.recordOutcome(op.id, receiptState(receipt), receipt, 'provider_response');
    } catch {
      return this.recordOutcome(op.id, 'unknown', null, 'provider_uncertain');
    }
  }
  async reconcile(id: string): Promise<BillingOperation> {
    const entity = await this.data.getRepository(OperationEntity).findOneByOrFail({ id });
    const op = serializeOperation(entity);
    if (TERMINAL.includes(op.state)) return op;
    const record = await this.data.getRepository(CaseEntity).findOneByOrFail({ id: op.caseId });
    const receipt =
      record.provider === 'simulator' ? op.receipt : await this.stripe.findReceipt(record, op);
    if (!receipt) return op;
    return this.recordOutcome(id, receiptState(receipt), receipt, 'reconciled');
  }
}
