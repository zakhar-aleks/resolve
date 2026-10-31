import type { MigrationInterface, QueryRunner } from 'typeorm';
export class PolicyPrompts1793458800000 implements MigrationInterface {
  name = 'PolicyPrompts1793458800000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      `ALTER TABLE agent_workflows ADD COLUMN "promptHash" text NOT NULL DEFAULT 'legacy';`,
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE agent_workflows DROP COLUMN "promptHash"');
  }
}
