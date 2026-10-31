import type { MigrationInterface, QueryRunner } from 'typeorm';
import { encrypt } from '../../security/encryption';
export class EncryptedContent1793460000000 implements MigrationInterface {
  name = 'EncryptedContent1793460000000';
  async up(runner: QueryRunner): Promise<void> {
    // Validate the key before making any schema or data changes.
    encrypt('key-check', 'migration');
    await runner.query(`ALTER TABLE agent_workflows ADD COLUMN lifecycle text, ADD COLUMN "accessMode" text, ADD COLUMN "updatedAt" text, ADD COLUMN "createdAt" text, ADD COLUMN "archivedAt" text;
      UPDATE agent_workflows SET lifecycle=result->>'state', "accessMode"=result->>'mode', "updatedAt"=result->>'updatedAt', "createdAt"=result->>'createdAt', "archivedAt"=result->>'archivedAt';
      ALTER TABLE support_cases ALTER COLUMN tags DROP DEFAULT;
      ALTER TABLE support_cases ALTER COLUMN tags TYPE jsonb USING to_jsonb(tags);`);
    const fields: Record<string, string[]> = {
      support_cases: ['name', 'title', 'message', 'customerId', 'summary', 'assignee', 'tags'],
      companies: ['profile'],
      privacy_settings: ['profile'],
      support_runs: ['result'],
      billing_operations: ['receipt'],
      agent_workflows: ['result', 'planRef'],
      workflow_settings: ['policy'],
      demo_service_state: ['state'],
    };
    for (const [table, columns] of Object.entries(fields)) {
      let cursor = '';
      while (true) {
        const rows = (await runner.query(
          `SELECT * FROM "${table}" WHERE id::text > $1 ORDER BY id::text LIMIT 200`,
          [cursor],
        )) as Record<string, unknown>[];
        if (!rows.length) break;
        for (const row of rows) {
          for (const column of columns) {
            if (row[column] === null) continue;
            const encoded = encrypt(row[column], `${table}.${column}`);
            const json = ['profile', 'result', 'receipt', 'policy', 'state', 'tags'].includes(
              column,
            );
            await runner.query(`UPDATE "${table}" SET "${column}"=$1 WHERE id=$2`, [
              json ? JSON.stringify(encoded) : encoded,
              row.id,
            ]);
          }
          cursor = String(row.id);
        }
      }
    }
    for (const column of ['summary', 'assignee']) {
      const value = encrypt('', `support_cases.${column}`);
      await runner.query(
        `ALTER TABLE support_cases ALTER COLUMN "${column}" SET DEFAULT '${value}'`,
      );
    }
    const tags = JSON.stringify(encrypt([], 'support_cases.tags'));
    await runner.query(`ALTER TABLE support_cases ALTER COLUMN tags SET DEFAULT '${tags}'::jsonb`);
  }
  async down(): Promise<void> {
    throw new Error('Restore a compatible backup to roll back encrypted storage.');
  }
}
