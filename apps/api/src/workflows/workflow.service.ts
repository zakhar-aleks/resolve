import { PolicyContextService } from '../support/prompts/policy-context.service';
import { CaseEntity } from '../database/entities/case.entity';
import { In, IsNull } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import {
  WORKFLOW_KINDS,
  type WorkflowCreate,
  type Workflow,
  type WorkflowPolicy,
  type ConnectorOutcome,
} from '@resolve/contracts';
import {
  WorkflowEntity,
  WorkflowSettingsEntity,
  DemoServiceEntity,
} from '../database/entities/workflow.entity';
import { PrivacyEntity } from '../database/entities/privacy.entity';
import { conflict, invalid } from '../common/errors';
import { ConnectorProvider } from './providers/connector.provider';
import {
  DEMO_CUSTOMER,
  DEMO_PROOF,
  demoChecks,
  actionSummary,
  applyDemoAction,
  needsConfirmation,
} from './domain/demo';
import { connectorChecks } from './domain/checks';
const hash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
export type WorkflowAccess = 'demo' | 'api';
@Injectable()
export class WorkflowService {
  constructor(
    private readonly data: DataSource,
    private readonly connector: ConnectorProvider,
    private readonly policies: PolicyContextService,
  ) {}
  async capabilities() {
    return {
      kinds: [...WORKFLOW_KINDS],
      demo: true,
      connectorConfigured: this.connector.configured(),
    };
  }
  async policy(): Promise<WorkflowPolicy> {
    return (await this.data.getRepository(WorkflowSettingsEntity).findOneByOrFail({ id: 1 }))
      .policy;
  }
  async savePolicy(input: WorkflowPolicy, access: WorkflowAccess): Promise<WorkflowPolicy> {
    if (access === 'demo' && this.connector.configured()) invalid('LIVE_API_ONLY');
    return this.data.transaction(async (manager) => {
      await this.policies.within(manager, true);
      const row = await this.lockSettings(manager);
      if (row.policy.revision !== input.revision) conflict('STALE_SETTINGS');
      row.policy = { ...input, revision: randomUUID() };
      await manager.update(
        CaseEntity,
        { status: In(['open', 'waiting']), archivedAt: IsNull() },
        { triageStatus: 'pending' },
      );
      await manager.save(row);
      return row.policy;
    });
  }
  async list(access: WorkflowAccess): Promise<Workflow[]> {
    const query = this.data.getRepository(WorkflowEntity).createQueryBuilder('workflow');
    if (access === 'demo') query.where("workflow.result->>'mode' = :mode", { mode: 'demo' });
    const rows = await query.orderBy("workflow.result->>'createdAt'", 'DESC').take(100).getMany();
    return rows.map((row) => row.result);
  }
  async get(id: string, access: WorkflowAccess): Promise<Workflow> {
    const row = await this.data.getRepository(WorkflowEntity).findOneByOrFail({ id });
    this.authorize(row, access);
    return row.result;
  }
  async demoState() {
    return (await this.data.getRepository(DemoServiceEntity).findOneByOrFail({ id: 1 })).state;
  }
  private lockSettings(manager: EntityManager) {
    return manager.findOneOrFail(WorkflowSettingsEntity, {
      where: { id: 1 },
      lock: { mode: 'pessimistic_write' },
    });
  }
  private authorize(row: WorkflowEntity, access: WorkflowAccess): void {
    if (access === 'demo' && row.result.mode !== 'demo') invalid('LIVE_API_ONLY');
  }
  async prepare(input: WorkflowCreate, access: WorkflowAccess): Promise<Workflow> {
    if (access === 'demo' && input.mode !== 'demo') invalid('LIVE_API_ONLY');
    return this.data.transaction(async (manager) => {
      const snapshot = await this.policies.within(manager, true);
      const settings = await this.lockSettings(manager);
      const existing = await manager.findOneBy(WorkflowEntity, {
        idempotencyKey: input.idempotencyKey,
      });
      const { verificationToken, ...publicInput } = input;
      const requestHash = hash({ ...publicInput, proofHash: hash(verificationToken) });
      if (existing) {
        this.authorize(existing, access);
        if (existing.requestHash !== requestHash) conflict('IDEMPOTENCY_CONFLICT');
        return existing.result;
      }
      const privacy = await manager.findOneOrFail(PrivacyEntity, {
        where: { id: 1 },
        lock: { mode: 'pessimistic_read' },
      });
      const id = randomUUID();
      let checks: Workflow['checks'];
      let resourceVersion: string;
      let planRef = '';
      let summary = actionSummary(input.action);
      let confirmationRequired = needsConfirmation(input.action);
      if (input.mode === 'demo') {
        const state = await manager.findOneOrFail(DemoServiceEntity, {
          where: { id: 1 },
          lock: { mode: 'pessimistic_read' },
        });
        checks = demoChecks(
          state.state,
          input.action,
          settings.policy,
          input.customerId === DEMO_CUSTOMER && verificationToken === DEMO_PROOF,
        );
        resourceVersion = String(state.state.version);
      } else {
        if (
          !privacy.profile.legalName ||
          !privacy.profile.privacyEmail ||
          privacy.profile.lawfulBasis === 'undecided' ||
          !['processors', 'security', 'notice'].every((id) =>
            privacy.profile.tasks.some((task) => task.id === id && task.confirmed),
          )
        )
          invalid('PRIVACY_SETUP_REQUIRED');
        const prepared = await this.connector.prepare(id, input, settings.policy);
        planRef = prepared.planRef;
        resourceVersion = prepared.resourceVersion;
        summary = prepared.summary;
        confirmationRequired = confirmationRequired || prepared.confirmationRequired;
        checks = connectorChecks(
          input.action,
          prepared.checks,
          prepared.ownershipVerified,
          settings.policy.enabledActions.includes(input.action.kind),
        );
      }
      const now = new Date().toISOString();
      const planHash = hash({
        action: input.action,
        customerId: input.customerId,
        resourceVersion,
        policy: settings.policy.revision,
        prompt: snapshot.metadata.snapshotHash,
        privacy: privacy.profile.revision,
      });
      const result: Workflow = {
        id,
        mode: input.mode,
        customerId: input.customerId,
        action: input.action,
        summary,
        checks,
        state: checks.every((check) => check.passed)
          ? confirmationRequired
            ? 'awaiting_confirmation'
            : 'ready'
          : 'blocked',
        planHash,
        confirmed: !confirmationRequired,
        receiptId: null,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };
      await manager.save(WorkflowEntity, {
        id,
        idempotencyKey: input.idempotencyKey,
        requestHash,
        promptHash: snapshot.metadata.snapshotHash,
        result,
        policyRevision: settings.policy.revision,
        privacyRevision: privacy.profile.revision,
        resourceVersion,
        planRef,
      });
      return result;
    });
  }
  async confirm(
    id: string,
    planHash: string,
    verificationToken: string,
    access: WorkflowAccess,
  ): Promise<Workflow> {
    return this.data.transaction(async (manager) => {
      const snapshot = await this.policies.within(manager, true);
      await this.lockSettings(manager);
      const row = await manager.findOneOrFail(WorkflowEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      this.authorize(row, access);
      if (row.promptHash !== snapshot.metadata.snapshotHash) conflict('PLAN_CHANGED');
      if (
        row.result.archivedAt ||
        row.result.planHash !== planHash ||
        !['awaiting_confirmation', 'ready'].includes(row.result.state)
      )
        conflict('INVALID_WORKFLOW_STATE');
      const confirmed =
        row.result.mode === 'demo'
          ? row.result.customerId === DEMO_CUSTOMER && verificationToken === DEMO_PROOF
          : (await this.connector.confirm(row.planRef, verificationToken)).confirmed;
      if (!confirmed) invalid('OWNERSHIP_REQUIRED');
      row.result.confirmed = true;
      row.result.state = 'ready';
      row.result.updatedAt = new Date().toISOString();
      await manager.save(row);
      return row.result;
    });
  }
  async execute(id: string, planHash: string, access: WorkflowAccess): Promise<Workflow> {
    const prepared = await this.data.transaction(async (manager) => {
      const snapshot = await this.policies.within(manager, true);
      const settings = await this.lockSettings(manager);
      const privacy = await manager.findOneOrFail(PrivacyEntity, {
        where: { id: 1 },
        lock: { mode: 'pessimistic_read' },
      });
      const row = await manager.findOneOrFail(WorkflowEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      this.authorize(row, access);
      if (row.result.planHash !== planHash || row.result.archivedAt) conflict('PLAN_CHANGED');
      if (['succeeded', 'executing', 'unknown'].includes(row.result.state)) return row;
      if (Date.now() - Date.parse(row.result.createdAt) > 900000) conflict('PLAN_EXPIRED');
      if (row.result.state !== 'ready' || !row.result.confirmed) conflict('APPROVAL_REQUIRED');
      if (
        row.promptHash !== snapshot.metadata.snapshotHash ||
        row.policyRevision !== settings.policy.revision ||
        row.privacyRevision !== privacy.profile.revision
      )
        conflict('PLAN_CHANGED');
      if (!row.result.action) conflict('INVALID_WORKFLOW_STATE');
      if (row.result.mode === 'demo') {
        const demo = await manager.findOneOrFail(DemoServiceEntity, {
          where: { id: 1 },
          lock: { mode: 'pessimistic_write' },
        });
        if (String(demo.state.version) !== row.resourceVersion) conflict('RESOURCE_CHANGED');
        const checks = demoChecks(demo.state, row.result.action, settings.policy, true);
        if (!checks.every((check) => check.passed)) conflict('POLICY_CHANGED');
        applyDemoAction(demo.state, row.result.action, row.id);
        await manager.save(demo);
        row.result.state = 'succeeded';
        row.result.receiptId = `demo_${row.id}`;
      } else row.result.state = 'executing';
      row.result.updatedAt = new Date().toISOString();
      await manager.save(row);
      return row;
    });
    if (prepared.result.mode === 'demo' || prepared.result.state !== 'executing')
      return prepared.result;
    // Only the transaction that changes ready to executing may dispatch.
    return this.dispatchOnce(prepared);
  }
  private async dispatchOnce(row: WorkflowEntity): Promise<Workflow> {
    // An atomic claim prevents concurrent callers from dispatching the same operation.
    const claim = await this.data
      .createQueryBuilder()
      .update(WorkflowEntity)
      .set({ dispatchStarted: true })
      .where('id = :id AND "dispatchStarted" = false', { id: row.id })
      .execute();
    if (claim.affected !== 1) return this.get(row.id, 'api');
    try {
      await this.connector.execute(row.id, row.planRef, row.result.planHash);
      return await this.reconcile(row.id, 'api');
    } catch {
      return this.setOutcome(row.id, null);
    }
  }
  private async setOutcome(id: string, outcome: ConnectorOutcome | null): Promise<Workflow> {
    return this.data.transaction(async (manager) => {
      const row = await manager.findOneOrFail(WorkflowEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (row.result.state === 'succeeded') return row.result;
      row.result.state =
        outcome?.status === 'succeeded'
          ? 'succeeded'
          : outcome?.status === 'failed'
            ? 'failed'
            : 'unknown';
      row.result.receiptId = outcome?.receiptId ?? null;
      row.result.updatedAt = new Date().toISOString();
      if (outcome) row.result.summary = outcome.summary;
      await manager.save(row);
      return row.result;
    });
  }
  async reconcile(id: string, access: WorkflowAccess): Promise<Workflow> {
    const row = await this.data.getRepository(WorkflowEntity).findOneByOrFail({ id });
    this.authorize(row, access);
    if (row.result.mode === 'demo' || !['unknown', 'executing'].includes(row.result.state))
      return row.result;
    try {
      return await this.setOutcome(id, await this.connector.outcome(id));
    } catch {
      return this.setOutcome(id, null);
    }
  }
}
