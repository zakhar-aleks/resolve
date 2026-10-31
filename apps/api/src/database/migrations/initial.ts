import type { MigrationInterface, QueryRunner } from 'typeorm';
export class Initial1793440800000 implements MigrationInterface {
  name = 'Initial1793440800000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE companies (id integer PRIMARY KEY CHECK (id=1), profile jsonb NOT NULL);
      CREATE TABLE support_cases (
        id text PRIMARY KEY, name text NOT NULL, title text NOT NULL, message text NOT NULL,
        "amountCents" integer NOT NULL CHECK ("amountCents">0), "ageDays" integer NOT NULL CHECK ("ageDays">=0),
        reason text NOT NULL CHECK (reason IN ('duplicate','requested','unknown','cancel')),
        "customerId" text NOT NULL, "paymentId" text NOT NULL, "refundedCents" integer NOT NULL DEFAULT 0,
        currency text NOT NULL DEFAULT 'usd', provider text NOT NULL DEFAULT 'simulator' CHECK (provider IN ('simulator','stripe')),
        "paymentStatus" text NOT NULL DEFAULT 'paid', "subscriptionStatus" text NOT NULL DEFAULT 'active',
        CHECK ("refundedCents">=0 AND "refundedCents"<="amountCents"),
        UNIQUE(provider,"paymentId")
      );
      CREATE TABLE support_runs (id uuid PRIMARY KEY, "caseId" text NOT NULL REFERENCES support_cases(id), result jsonb NOT NULL, "createdAt" timestamptz NOT NULL);
      CREATE TABLE billing_operations (
        id uuid PRIMARY KEY, "runId" uuid UNIQUE NOT NULL REFERENCES support_runs(id), "caseId" text NOT NULL REFERENCES support_cases(id),
        action text NOT NULL CHECK (action IN ('refund','cancel')), state text NOT NULL CHECK (state IN ('dispatched','unknown','pending','succeeded','failed','canceled')),
        "amountCents" integer NOT NULL CHECK ("amountCents">=0), receipt jsonb, "createdAt" timestamptz NOT NULL
      );
      CREATE UNIQUE INDEX one_unresolved_operation_per_case ON billing_operations("caseId") WHERE state IN ('dispatched','unknown','pending');
      CREATE TABLE action_events (id uuid PRIMARY KEY, "operationId" uuid NOT NULL REFERENCES billing_operations(id), state text NOT NULL, code text NOT NULL, "createdAt" timestamptz NOT NULL);
      CREATE INDEX events_created ON action_events("createdAt");
      CREATE INDEX runs_created ON support_runs("createdAt");
    `);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      'DROP TABLE action_events, billing_operations, support_runs, support_cases, companies',
    );
  }
}
