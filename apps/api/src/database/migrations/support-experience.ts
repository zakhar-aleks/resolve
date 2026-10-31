import type { MigrationInterface, QueryRunner } from 'typeorm';
export class SupportExperience1793444400000 implements MigrationInterface {
  name = 'SupportExperience1793444400000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
 CREATE TABLE privacy_settings(id integer PRIMARY KEY CHECK(id=1),profile jsonb NOT NULL);
 ALTER TABLE support_cases DROP CONSTRAINT "support_cases_amountCents_check";
 ALTER TABLE support_cases ADD CONSTRAINT positive_payment_amount CHECK("amountCents">=0);
 ALTER TABLE support_cases DROP CONSTRAINT support_cases_provider_check;
 ALTER TABLE support_cases ADD CONSTRAINT supported_provider CHECK(provider IN ('simulator','stripe','unlinked'));
 ALTER TABLE support_cases ADD COLUMN summary text NOT NULL DEFAULT '', ADD COLUMN "triageStatus" text NOT NULL DEFAULT 'pending',
 ADD COLUMN tags text[] NOT NULL DEFAULT '{}', ADD COLUMN assignee text NOT NULL DEFAULT '',
 ADD COLUMN channel text NOT NULL DEFAULT 'workspace', ADD COLUMN "externalId" text UNIQUE,
 ADD COLUMN "aiPreference" text NOT NULL DEFAULT 'allowed', ADD COLUMN "receivedAt" timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN "closedAt" timestamptz, ADD COLUMN "archivedAt" timestamptz, ADD COLUMN status text NOT NULL DEFAULT 'open';
 UPDATE support_cases c SET status='resolved', "closedAt"=o."createdAt" FROM billing_operations o WHERE o."caseId"=c.id AND o.state='succeeded';
 CREATE INDEX pending_triage ON support_cases("triageStatus");
 `);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      `DROP TABLE privacy_settings; ALTER TABLE support_cases DROP COLUMN summary,DROP COLUMN "triageStatus",DROP COLUMN tags,DROP COLUMN assignee,DROP COLUMN channel,DROP COLUMN "externalId",DROP COLUMN "aiPreference",DROP COLUMN "receivedAt",DROP COLUMN "closedAt",DROP COLUMN "archivedAt",DROP COLUMN status;`,
    );
  }
}
