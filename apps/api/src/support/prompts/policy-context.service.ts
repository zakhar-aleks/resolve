import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  CompanySchema,
  PrivacyProfileSchema,
  WorkflowPolicySchema,
  type SupportCase,
  type PromptPreview,
} from '@resolve/contracts';
import { CompanyEntity } from '../../database/entities/company.entity';
import { PrivacyEntity } from '../../database/entities/privacy.entity';
import { WorkflowSettingsEntity } from '../../database/entities/workflow.entity';
import { CaseEntity } from '../../database/entities/case.entity';
import { environment } from '../../config/environment';
import { conflict, invalid } from '../../common/errors';
import { buildSnapshot, type PolicySnapshot } from './prompt-builder';
@Injectable()
export class PolicyContextService {
  constructor(private readonly data: DataSource) {}
  async within(manager: EntityManager, workflowWrite = false): Promise<PolicySnapshot> {
    const company = await manager.findOneOrFail(CompanyEntity, {
      where: { id: 1 },
      lock: { mode: 'pessimistic_read' },
    });
    const actions = await manager.findOneOrFail(WorkflowSettingsEntity, {
      where: { id: 1 },
      lock: { mode: workflowWrite ? 'pessimistic_write' : 'pessimistic_read' },
    });
    const privacy = await manager.findOneOrFail(PrivacyEntity, {
      where: { id: 1 },
      lock: { mode: 'pessimistic_read' },
    });
    return buildSnapshot(
      CompanySchema.parse(company.profile),
      PrivacyProfileSchema.parse(privacy.profile),
      WorkflowPolicySchema.parse(actions.policy),
    );
  }
  load(): Promise<PolicySnapshot> {
    return this.data.transaction((manager) => this.within(manager));
  }
  preview(snapshot: PolicySnapshot): PromptPreview {
    return {
      metadata: snapshot.metadata,
      systemPrompt: snapshot.systemPrompt,
      smallModel: environment.MISTRAL_MODEL,
      largeModel: environment.MISTRAL_LARGE_MODEL || null,
      routingMode: snapshot.company.routingMode,
    };
  }
  async assertExternalAllowed(snapshot: PolicySnapshot, record: SupportCase): Promise<void> {
    await this.data.transaction(async (manager) => {
      const current = await this.within(manager);
      const stored = await manager.findOneByOrFail(CaseEntity, { id: record.id });
      if (
        current.metadata.snapshotHash !== snapshot.metadata.snapshotHash ||
        stored.aiPreference !== record.aiPreference ||
        stored.message !== record.message
      )
        conflict('POLICY_CHANGED');
      if (stored.archivedAt) conflict('ARCHIVED_REQUEST');
      if (
        !current.privacy.aiEnabled ||
        stored.aiPreference === 'human_only' ||
        current.company.decisionEngine === 'rules'
      )
        invalid('EXTERNAL_AI_DISABLED');
    });
  }
}
