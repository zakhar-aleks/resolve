import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
const base = process.env.DATABASE_URL ?? 'postgresql://resolve:resolve@127.0.0.1:55432/resolve';
const admin = new pg.Client({ connectionString: base });
const name = `resolve_test_${randomUUID().replaceAll('-', '')}`;
const url = new URL(base);
url.pathname = `/${name}`;
let child;
const origin = 'http://127.0.0.1:8798/api';
async function request(path, method = 'GET', body) {
  const response = await fetch(origin + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}
before(
  async () => {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${name}"`);
    child = spawn(process.execPath, ['dist/main.js'], {
      cwd: new URL('../', import.meta.url),
      env: {
        ...process.env,
        DATABASE_URL: url.href,
        API_PORT: '8798',
        MISTRAL_API_KEY: '',
        TYPESAFE_API_KEY: '',
        STRIPE_SECRET_KEY: '',
        STRIPE_TEST_CUSTOMER_ID: '',
        STRIPE_TEST_PAYMENT_INTENT_ID: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let logs = '';
    child.stdout.on('data', (chunk) => {
      logs += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      logs += String(chunk);
    });
    for (let i = 0; i < 120; i++) {
      try {
        const response = await fetch(origin + '/state');
        if (response.ok) return;
      } catch {}
      if (child.exitCode !== null) throw new Error(logs);
      await delay(250);
    }
    throw new Error(`Backend startup timed out: ${logs}`);
  },
  { timeout: 40000 },
);
after(async () => {
  child?.kill('SIGTERM');
  if (child) await new Promise((resolve) => child.once('exit', resolve));
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.end();
});
test('migrations and settings persistence use PostgreSQL', async () => {
  const state = await request('/state');
  assert.equal(state.status, 200);
  assert.equal(state.body.cases.length, 6);
  const profile = { ...state.body.company, companyName: 'Integration Company' };
  const saved = await request('/company', 'PUT', profile);
  assert.equal(saved.status, 200);
  assert.notEqual(saved.body.revision, profile.revision);
  assert.equal((await request('/state')).body.company.companyName, 'Integration Company');
  assert.equal((await request('/company', 'PUT', profile)).status, 409);
});
test('validation rejects unknown properties and invalid amounts', async () => {
  const state = (await request('/state')).body;
  assert.equal(
    (await request('/company', 'PUT', { ...state.company, refundWindowDays: -1 })).status,
    400,
  );
  assert.equal(
    (
      await request('/cases', 'POST', {
        name: 'X',
        title: 'X',
        message: 'X',
        amountCents: 1,
        ageDays: 1,
        reason: 'duplicate',
        force: true,
      })
    ).status,
    400,
  );
});
test('concurrent execution creates exactly one refund', async () => {
  const a = (
    await request('/cases/duplicate/analyze', 'POST', { message: 'Refund my duplicate payment.' })
  ).body;
  const b = (
    await request('/cases/duplicate/analyze', 'POST', { message: 'Refund my duplicate payment.' })
  ).body;
  const results = await Promise.all([
    request(`/runs/${a.id}/execute`, 'POST', {}),
    request(`/runs/${b.id}/execute`, 'POST', {}),
  ]);
  assert.equal(results.filter((item) => item.status === 201).length, 1);
  const successful = results.find((item) => item.status === 201);
  assert.ok(successful);
  const repeated = await request(`/runs/${successful.body.runId}/execute`, 'POST', {});
  assert.equal(repeated.body.id, successful.body.id);
  const state = (await request('/state')).body;
  assert.equal(state.operations.filter((op) => op.caseId === 'duplicate').length, 1);
  assert.equal(state.cases.find((record) => record.id === 'duplicate').refundedCents, 2900);
});
test('policy changes invalidate a prepared approval', async () => {
  const run = (
    await request('/cases/cancel/analyze', 'POST', { message: 'Cancel my subscription.' })
  ).body;
  const state = (await request('/state')).body;
  await request('/company', 'PUT', { ...state.company, reviewAll: true });
  const result = await request(`/runs/${run.id}/execute`, 'POST', {});
  assert.equal(result.status, 409);
  assert.equal(result.body.code, 'POLICY_CHANGED');
  const updated = (await request('/state')).body;
  await request('/company', 'PUT', { ...updated.company, reviewAll: false });
});
test('lost acknowledgement reconciles the original receipt', async () => {
  const run = (
    await request('/cases/timeout/analyze', 'POST', { message: 'Refund the duplicate payment.' })
  ).body;
  const operation = (await request(`/runs/${run.id}/execute`, 'POST', {})).body;
  assert.equal(operation.state, 'unknown');
  const reconciled = (await request(`/operations/${operation.id}/reconcile`, 'POST', {})).body;
  assert.equal(reconciled.state, 'succeeded');
  assert.equal(reconciled.id, operation.id);
  const state = (await request('/state')).body;
  assert.equal(state.operations.filter((op) => op.caseId === 'timeout').length, 1);
});
test('model secrets never appear in the public state', async () => {
  const key = 'integration-secret-never-expose';
  assert.equal((await request('/connections', 'POST', { provider: 'mistral', key })).status, 200);
  const state = await request('/state');
  assert.equal(JSON.stringify(state.body).includes(key), false);
  assert.equal(state.body.connections.mistral, true);
});
