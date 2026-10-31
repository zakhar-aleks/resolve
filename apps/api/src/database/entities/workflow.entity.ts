import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { Workflow, WorkflowPolicy } from '@resolve/contracts';
import type { DemoState } from '../../workflows/domain/demo';
@Entity('agent_workflows')
export class WorkflowEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { unique: true }) idempotencyKey!: string;
  @Column('text') requestHash!: string;
  @Column('jsonb') result!: Workflow;
  @Column('text') policyRevision!: string;
  @Column('text') privacyRevision!: string;
  @Column('text') resourceVersion!: string;
  @Column('text') planRef!: string;
  @Column('text', { default: 'legacy' }) promptHash = 'legacy';
  @Column('boolean', { default: false }) dispatchStarted = false;
}
@Entity('workflow_settings')
export class WorkflowSettingsEntity {
  @PrimaryColumn('integer') id!: number;
  @Column('jsonb') policy!: WorkflowPolicy;
}
@Entity('demo_service_state')
export class DemoServiceEntity {
  @PrimaryColumn('integer') id!: number;
  @Column('jsonb') state!: DemoState;
}
