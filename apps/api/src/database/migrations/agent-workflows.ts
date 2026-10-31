import type { MigrationInterface, QueryRunner } from 'typeorm';
export class AgentWorkflows1793451600000 implements MigrationInterface {
  name = 'AgentWorkflows1793451600000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
 CREATE TABLE agent_workflows(id uuid PRIMARY KEY,"idempotencyKey" uuid UNIQUE NOT NULL,"requestHash" text NOT NULL,result jsonb NOT NULL,"policyRevision" text NOT NULL,"privacyRevision" text NOT NULL,"resourceVersion" text NOT NULL,"planRef" text NOT NULL,"dispatchStarted" boolean NOT NULL DEFAULT false);
 CREATE TABLE workflow_settings(id integer PRIMARY KEY CHECK(id=1),policy jsonb NOT NULL);
 CREATE TABLE demo_service_state(id integer PRIMARY KEY CHECK(id=1),state jsonb NOT NULL);
 `);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE agent_workflows,workflow_settings,demo_service_state');
  }
}
