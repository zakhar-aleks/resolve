import type { MigrationInterface, QueryRunner } from 'typeorm';
export class Accounts1793461000000 implements MigrationInterface {
  name = 'Accounts1793461000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
 CREATE TABLE account_users (id uuid PRIMARY KEY, "identityHash" text UNIQUE NOT NULL, email text NOT NULL, "emailHash" text NOT NULL, provider text NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "privacyVersion" text, "termsVersion" text, "termsAcceptedAt" timestamptz);
 CREATE TABLE account_workspaces (id uuid PRIMARY KEY, "databaseName" text UNIQUE NOT NULL, ready boolean NOT NULL DEFAULT false);
 CREATE TABLE account_memberships ("userId" uuid NOT NULL REFERENCES account_users(id), "workspaceId" uuid NOT NULL REFERENCES account_workspaces(id), role text NOT NULL CHECK(role IN ('owner','agent','reviewer')), PRIMARY KEY("userId","workspaceId"));
 CREATE TABLE account_sessions (hash text PRIMARY KEY, "userId" uuid NOT NULL REFERENCES account_users(id), "workspaceId" uuid REFERENCES account_workspaces(id), "expiresAt" timestamptz NOT NULL);
 CREATE TABLE account_flows ("stateHash" text PRIMARY KEY, "browserHash" text NOT NULL, provider text NOT NULL, secret text NOT NULL, "expiresAt" timestamptz NOT NULL);
 CREATE TABLE account_invites (hash text PRIMARY KEY, "workspaceId" uuid NOT NULL REFERENCES account_workspaces(id), "createdBy" uuid NOT NULL REFERENCES account_users(id), "emailHash" text NOT NULL, role text NOT NULL CHECK(role IN ('agent','reviewer')), "expiresAt" timestamptz NOT NULL);
 CREATE TABLE workspace_credentials (id text PRIMARY KEY, value text NOT NULL);
 CREATE TABLE account_api_keys (hash text PRIMARY KEY, "workspaceId" uuid NOT NULL REFERENCES account_workspaces(id), role text NOT NULL CHECK(role IN ('intake','reviewer')));
 CREATE INDEX session_expiry ON account_sessions("expiresAt");
 CREATE INDEX invite_expiry ON account_invites("expiresAt");`);
  }
  async down(): Promise<void> {
    throw new Error('Account rollback requires a compatible backup.');
  }
}
