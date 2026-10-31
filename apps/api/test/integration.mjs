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
        SLACK_APP_TOKEN: '',
        SLACK_TEAM_ID: '',
        SLACK_CHANNEL_IDS: '',
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
  if (child && child.exitCode === null) await new Promise((resolve) => child.once('exit', resolve));
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
test('new human-only requests are prepared automatically without billing authority', async () => {
  const intake = await request('/intake', 'POST', {
    name: 'Test Customer',
    title: 'Please refund',
    message: 'Please refund an unexpected charge.',
    aiPreference: 'human_only',
  });
  assert.equal(intake.status, 201);
  assert.deepEqual(Object.keys(intake.body), ['reference']);
  let record;
  for (let i = 0; i < 60; i++) {
    record = (await request('/state')).body.cases.find((item) => item.id === intake.body.reference);
    if (record?.summary && !['pending', 'processing'].includes(record.triageStatus)) break;
    await delay(100);
  }
  assert.ok(record.summary);
  assert.equal(record.provider, 'unlinked');
  assert.equal(record.aiPreference, 'human_only');
  const state = (await request('/state')).body;
  const run = state.runs.find((item) => item.caseId === record.id);
  assert.equal(run.decision.source, 'rules');
  assert.ok(!['refund', 'cancel'].includes(run.decision.action));
  const updated = await request(`/cases/${record.id}`, 'PATCH', {
    tags: ['Billing', 'Priority'],
    assignee: 'Support team',
    status: 'waiting',
    aiPreference: 'human_only',
  });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.body.tags, ['Billing', 'Priority']);
  assert.equal(updated.body.assignee, 'Support team');
});
test('privacy setup gates external AI and public notice hides internal evidence', async () => {
  const privacy = (await request('/privacy')).body;
  assert.equal((await request('/privacy', 'PUT', { ...privacy, aiEnabled: true })).status, 400);
  const saved = await request('/privacy', 'PUT', {
    ...privacy,
    tasks: privacy.tasks.map((task) =>
      task.id === 'scope'
        ? { ...task, owner: 'Internal owner', evidence: 'Internal assessment', confirmed: true }
        : task,
    ),
  });
  assert.equal(saved.status, 200);
  const notice = await request('/privacy/notice');
  assert.equal(notice.status, 200);
  assert.equal(JSON.stringify(notice.body).includes('Internal assessment'), false);
  assert.equal('tasks' in notice.body.profile, false);
});
test('retention removes expired closed conversation content and preserves billing receipts', async () => {
  const client = new pg.Client({ connectionString: url.href });
  await client.connect();
  try {
    await client.query(
      `UPDATE support_cases SET status='resolved', "closedAt"=now()-interval '400 days' WHERE id='duplicate'`,
    );
    const result = await request('/privacy/retention', 'POST', {});
    assert.equal(result.status, 201);
    const state = (await request('/state')).body;
    const record = state.cases.find((item) => item.id === 'duplicate');
    assert.ok(record.archivedAt);
    assert.equal(record.customerId, '');
    assert.equal(record.name, 'Customer');
    assert.ok(
      state.runs
        .filter((item) => item.caseId === 'duplicate')
        .every((item) => item.message === 'Content removed under retention policy.'),
    );
    assert.ok(state.operations.find((item) => item.caseId === 'duplicate').receipt);
  } finally {
    await client.end();
  }
});
