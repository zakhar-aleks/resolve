import { encryptedColumn } from '../../security/encryption';
import { BeforeInsert, BeforeUpdate, Column, Entity, PrimaryColumn } from 'typeorm';
import type { Workflow, WorkflowPolicy } from '@resolve/contracts';
import type { DemoState } from '../../workflows/domain/demo';
@Entity('agent_workflows')
export class WorkflowEntity {
  @Column('text') lifecycle!: string;
  @Column('text') accessMode!: string;
  @Column('text') updatedAt!: string;
  @Column('text') createdAt!: string;
  @Column('text', { nullable: true }) archivedAt!: string | null;
  @BeforeInsert() @BeforeUpdate() syncMetadata(): void {
    this.lifecycle = this.result.state;
    this.accessMode = this.result.mode;
    this.updatedAt = this.result.updatedAt;
    this.createdAt = this.result.createdAt;
    this.archivedAt = this.result.archivedAt ?? null;
  }
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { unique: true }) idempotencyKey!: string;
  @Column('text') requestHash!: string;
  @Column('jsonb', { transformer: encryptedColumn('agent_workflows.result') }) result!: Workflow;
  @Column('text') policyRevision!: string;
  @Column('text') privacyRevision!: string;
  @Column('text') resourceVersion!: string;
  @Column('text', { transformer: encryptedColumn('agent_workflows.planRef') }) planRef!: string;
  @Column('text', { default: 'legacy' }) promptHash = 'legacy';
  @Column('boolean', { default: false }) dispatchStarted = false;
}
@Entity('workflow_settings')
export class WorkflowSettingsEntity {
  @PrimaryColumn('integer') id!: number;
  @Column('jsonb', { transformer: encryptedColumn('workflow_settings.policy') })
  policy!: WorkflowPolicy;
}
@Entity('demo_service_state')
export class DemoServiceEntity {
  @PrimaryColumn('integer') id!: number;
  @Column('jsonb', { transformer: encryptedColumn('demo_service_state.state') }) state!: DemoState;
}
