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
const internalToken = 'integration-internal-token-00000000000000000';
const origin = 'http://127.0.0.1:8798/api';
async function request(path, method = 'GET', body) {
  const response = await fetch(origin + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Resolve-Internal': internalToken },
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
        INTERNAL_API_TOKEN: internalToken,
        RESOLVE_API_KEY: 'integration-agent-key-000000000000000000',
        RESOLVE_REVIEWER_KEY: 'integration-reviewer-key-000000000000000',
        SERVICE_CONNECTOR_URL: '',
        SERVICE_CONNECTOR_TOKEN: '',
        SLACK_BOT_TOKEN: '',
        MISTRAL_API_KEY: '',
        MISTRAL_LARGE_MODEL: '',
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
        const response = await fetch(origin + '/state', {
          headers: { 'X-Resolve-Internal': internalToken },
        });
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
const agentKey = 'integration-agent-key-000000000000000000';
const reviewerKey = 'integration-reviewer-key-000000000000000';
async function agent(path, method = 'GET', body, key = agentKey) {
  const response = await fetch(origin + '/v1/agent' + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}
const workflowInput = (action) => ({
  idempotencyKey: randomUUID(),
  mode: 'demo',
  customerId: 'customer_demo',
  verificationToken: 'demo-customer-verification',
  action,
});
test('agent API requires keys and separates approval from intake', async () => {
  assert.equal((await agent('/capabilities', 'GET', undefined, 'bad')).status, 401);
  assert.equal((await agent('/capabilities')).body.kinds.length, 6);
  assert.equal((await agent('/schema')).body.openapi, '3.1.0');
  assert.equal((await agent('/requests/not-an-id')).status, 400);
  const publicState = JSON.stringify((await request('/state')).body);
  assert.equal(publicState.includes(agentKey), false);
  assert.equal(publicState.includes(reviewerKey), false);
  assert.equal(
    (
      await agent('/requests/00000000-0000-4000-8000-000000000000/execute', 'POST', {
        planHash: 'a'.repeat(64),
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await agent('/requests/00000000-0000-4000-8000-000000000000/execute/', 'POST', {
        planHash: 'a'.repeat(64),
      })
    ).status,
    401,
  );
  const result = await agent('/messages', 'POST', {
    name: 'Demo',
    title: 'Address update',
    message: 'Please change my delivery address.',
    aiPreference: 'human_only',
  });
  assert.equal(result.body.suggestedAction, 'change_address');
});
test('all six actions persist verified demo outcomes', async () => {
  const actions = [
    {
      kind: 'change_address',
      resourceId: 'order_demo',
      address: { line1: '20 Fictional Road', city: 'Paris', postalCode: '75001', country: 'FR' },
    },
    {
      kind: 'arrange_return',
      resourceId: 'return_order_demo',
      itemId: 'item_demo',
      quantity: 1,
      resolution: 'replacement',
      reason: 'Damaged item',
    },
    { kind: 'reschedule_appointment', resourceId: 'appointment_demo', slotId: 'slot_morning' },
    { kind: 'recover_account', resourceId: 'account_demo' },
    {
      kind: 'update_preferences',
      resourceId: 'customer_demo',
      marketingEmail: false,
      productUpdates: false,
    },
    { kind: 'privacy_request', resourceId: 'customer_demo', requestType: 'erasure' },
  ];
  for (const action of actions) {
    const input = workflowInput(action);
    const prepared = await agent('/requests', 'POST', input);
    assert.equal(prepared.status, 201, JSON.stringify(prepared.body));
    const plan = prepared.body;
    assert.equal((await agent('/requests', 'POST', input)).body.id, plan.id);
    assert.equal(JSON.stringify(plan).includes(input.verificationToken), false);
    if (plan.state === 'awaiting_confirmation') {
      assert.equal(
        (
          await agent(
            `/requests/${plan.id}/execute`,
            'POST',
            { planHash: plan.planHash },
            reviewerKey,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await agent(`/requests/${plan.id}/confirm`, 'POST', {
            planHash: plan.planHash,
            verificationToken: 'wrong',
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await agent(`/requests/${plan.id}/confirm`, 'POST', {
            planHash: plan.planHash,
            verificationToken: input.verificationToken,
          })
        ).body.state,
        'ready',
      );
    }
    const results = await Promise.all([
      agent(`/requests/${plan.id}/execute`, 'POST', { planHash: plan.planHash }, reviewerKey),
      agent(`/requests/${plan.id}/execute`, 'POST', { planHash: plan.planHash }, reviewerKey),
    ]);
    assert.ok(
      results.every((result) => result.status === 201 && result.body.state === 'succeeded'),
      JSON.stringify(results),
    );
    assert.equal(results[0].body.receiptId, results[1].body.receiptId);
  }
  const state = (await agent('/demo')).body;
  assert.equal(state.version, 7);
  assert.equal(state.order.address.city, 'Paris');
  assert.equal(state.returnOrder.stock, 4);
  assert.equal(state.returnOrder.returns.length, 1);
  assert.equal(state.appointment.slotId, 'slot_morning');
  assert.equal(state.account.recoveryRequests.length, 1);
  assert.equal(state.preferences.marketingEmail, false);
  assert.equal(state.privacyRequests[0].status, 'awaiting_specialist_review');
});
test('workflow ownership, idempotency and changed policies fail closed', async () => {
  const input = workflowInput({ kind: 'recover_account', resourceId: 'account_demo' });
  const invalid = await agent('/requests', 'POST', { ...input, verificationToken: 'wrong' });
  assert.equal(invalid.body.state, 'blocked');
  assert.equal(
    (
      await agent(
        `/requests/${invalid.body.id}/execute`,
        'POST',
        { planHash: invalid.body.planHash },
        reviewerKey,
      )
    ).status,
    409,
  );
  assert.equal((await agent('/requests', 'POST', input)).status, 409);
  const ready = (await agent('/requests', 'POST', { ...input, idempotencyKey: randomUUID() })).body;
  const policy = (await agent('/policy')).body;
  assert.equal((await agent('/policy', 'PUT', { ...policy, enabledActions: [] })).status, 401);
  assert.equal(
    (await agent('/policy', 'PUT', { ...policy, enabledActions: [] }, reviewerKey)).status,
    200,
  );
  assert.equal(
    (
      await agent(
        `/requests/${ready.id}/execute`,
        'POST',
        { planHash: ready.planHash },
        reviewerKey,
      )
    ).body.code,
    'PLAN_CHANGED',
  );
  const current = (await agent('/policy')).body;
  await agent('/policy', 'PUT', { ...current, enabledActions: policy.enabledActions }, reviewerKey);
});
test('connector dispatch is claimed once and unknown outcomes reconcile without another write', async () => {
  const { DataSource } = await import('typeorm');
  const { databaseOptions } = await import('../dist/database/data-source.js');
  const { WorkflowService } = await import('../dist/workflows/workflow.service.js');
  const data = new DataSource({ ...databaseOptions, url: url.href, migrationsRun: false });
  await data.initialize();
  const privacy = (await request('/privacy')).body;
  await request('/privacy', 'PUT', {
    ...privacy,
    legalName: 'Fictional Company',
    privacyEmail: 'privacy@example.com',
    lawfulBasis: 'contract',
    tasks: privacy.tasks.map((task) =>
      ['processors', 'security', 'notice'].includes(task.id)
        ? { ...task, owner: 'Test owner', evidence: 'Test assessment', confirmed: true }
        : task,
    ),
  });
  let writes = 0;
  let acknowledged = false;
  const connector = {
    configured: () => true,
    prepare: async () => ({
      planRef: 'server-plan-reference',
      summary: 'Request account recovery',
      ownershipVerified: true,
      resourceVersion: '1',
      confirmationRequired: false,
      checks: [
        { code: 'resource_found', passed: true },
        { code: 'recovery_rate_limit', passed: true },
      ],
    }),
    execute: async () => {
      writes++;
      await delay(20);
      throw new Error('Lost acknowledgement');
    },
    outcome: async () => {
      if (!acknowledged) throw new Error('Unavailable');
      return {
        status: 'succeeded',
        receiptId: 'provider-receipt',
        summary: 'Recovery request accepted by the identity provider.',
      };
    },
  };
  const { PolicyContextService } =
    await import('../dist/support/prompts/policy-context.service.js');
  const service = new WorkflowService(data, connector, new PolicyContextService(data));
  try {
    const workflow = await service.prepare(
      {
        ...workflowInput({ kind: 'recover_account', resourceId: 'account_live' }),
        mode: 'connector',
      },
      'api',
    );
    assert.equal(JSON.stringify(workflow).includes('server-plan-reference'), false);
    await Promise.all([
      service.execute(workflow.id, workflow.planHash, 'api'),
      service.execute(workflow.id, workflow.planHash, 'api'),
    ]);
    assert.equal(writes, 1);
    assert.equal((await service.get(workflow.id, 'api')).state, 'unknown');
    await service.execute(workflow.id, workflow.planHash, 'api');
    assert.equal(writes, 1);
    acknowledged = true;
    assert.equal((await service.reconcile(workflow.id, 'api')).state, 'succeeded');
    assert.equal(writes, 1);
    assert.equal(
      (await request('/state')).body.workflows.some((item) => item.id === workflow.id),
      false,
    );
  } finally {
    await data.destroy();
  }
});
test('expired workflow content is removed while idempotency identity remains', async () => {
  const client = new pg.Client({ connectionString: url.href });
  await client.connect();
  try {
    const row = (
      await client.query(
        `SELECT id FROM agent_workflows WHERE result->>'state'='succeeded' LIMIT 1`,
      )
    ).rows[0];
    assert.ok(row);
    await client.query(
      `UPDATE agent_workflows SET result=jsonb_set(result,'{updatedAt}',to_jsonb('2020-01-01T00:00:00.000Z'::text)) WHERE id=$1`,
      [row.id],
    );
    await request('/privacy/retention', 'POST', {});
    const archived = (await agent(`/requests/${row.id}`)).body;
    assert.ok(archived.archivedAt);
    assert.equal(archived.action, null);
    assert.equal(archived.customerId, '');
    assert.ok(archived.receiptId);
  } finally {
    await client.end();
  }
});
test('saved company, action and privacy changes rebuild the effective system prompt', async () => {
  const first = (await request('/company/prompt')).body;
  assert.ok(first.systemPrompt.includes('POLITENESS'));
  assert.ok(first.systemPrompt.includes('PRIVACY'));
  assert.ok(first.systemPrompt.includes('SECURITY'));
  const company = (await request('/company')).body;
  const updated = await request('/company', 'PUT', {
    ...company,
    writtenPolicy: 'PROMPT-POLICY-MARKER: route exceptions to a specialist.',
  });
  assert.equal(updated.status, 200);
  const next = (await request('/company/prompt')).body;
  assert.notEqual(next.metadata.snapshotHash, first.metadata.snapshotHash);
  assert.ok(next.systemPrompt.includes('PROMPT-POLICY-MARKER'));
  assert.equal(next.metadata.companyRevision, updated.body.revision);
  const policy = (await agent('/policy')).body;
  await agent('/policy', 'PUT', { ...policy, maxRecoveryPerDay: 2 }, reviewerKey);
  const actions = (await request('/company/prompt')).body;
  assert.notEqual(actions.metadata.snapshotHash, next.metadata.snapshotHash);
  assert.ok(actions.systemPrompt.includes('"maxRecoveryPerDay": 2'));
  const privacy = (await request('/privacy')).body;
  await request('/privacy', 'PUT', {
    ...privacy,
    retentionDays: 45,
    tasks: privacy.tasks.map((task) =>
      task.id === 'scope' ? { ...task, evidence: 'DO-NOT-SEND-INTERNAL-EVIDENCE' } : task,
    ),
  });
  const latest = (await request('/company/prompt')).body;
  assert.notEqual(latest.metadata.snapshotHash, actions.metadata.snapshotHash);
  assert.equal(latest.systemPrompt.includes('DO-NOT-SEND-INTERNAL-EVIDENCE'), false);
  assert.equal((await agent('/prompt')).status, 401);
  assert.equal(
    (await agent('/prompt', 'GET', undefined, reviewerKey)).body.metadata.snapshotHash,
    latest.metadata.snapshotHash,
  );
});
test('a company policy change invalidates an unexecuted non-payment plan', async () => {
  const plan = (
    await agent(
      '/requests',
      'POST',
      workflowInput({
        kind: 'update_preferences',
        resourceId: 'customer_demo',
        marketingEmail: false,
        productUpdates: true,
      }),
    )
  ).body;
  assert.equal(plan.state, 'ready');
  const company = (await request('/company')).body;
  await request('/company', 'PUT', { ...company, context: 'Updated support context' });
  assert.equal(
    (await agent(`/requests/${plan.id}/execute`, 'POST', { planHash: plan.planHash }, reviewerKey))
      .body.code,
    'PLAN_CHANGED',
  );
});
test('a recommendation completed after a policy change is discarded, not saved', async () => {
  const { DataSource } = await import('typeorm');
  const { databaseOptions } = await import('../dist/database/data-source.js');
  const { PolicyContextService } =
    await import('../dist/support/prompts/policy-context.service.js');
  const { SupportService } = await import('../dist/support/support.service.js');
  const { StripeProvider } = await import('../dist/billing/stripe.provider.js');
  const data = new DataSource({ ...databaseOptions, url: url.href, migrationsRun: false });
  await data.initialize();
  const intake = (
    await request('/intake', 'POST', {
      name: 'Fictional race customer',
      title: 'Delivery change',
      message: 'Change my address',
      aiPreference: 'human_only',
    })
  ).body;
  let started;
  let release;
  const entered = new Promise((resolve) => {
    started = resolve;
  });
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  const orchestrator = {
    prepare: async () => {
      started();
      await waiting;
      return {
        analysis: {
          intent: 'investigate',
          summary: 'STALE-TEST-RECOMMENDATION',
          source: 'delayed-test',
        },
        checks: [],
        decision: {
          action: 'review',
          risk: null,
          fulfillment: null,
          confidence: null,
          rationale: '',
          reply: '',
          source: 'delayed-test',
        },
        routing: {
          scenario: 'change_address',
          complexity: 'low',
          destination: 'local',
          model: null,
          reason: 'human_only',
        },
      };
    },
  };
  const service = new SupportService(
    data,
    new StripeProvider(),
    new PolicyContextService(data),
    orchestrator,
  );
  try {
    const pending = service.analyze(intake.reference, 'Change my address').catch((error) => error);
    await entered;
    const company = (await request('/company')).body;
    await request('/company', 'PUT', {
      ...company,
      writtenPolicy: 'A new policy arrived while the analysis was running.',
    });
    release();
    const error = await pending;
    assert.equal(error.getResponse().code, 'POLICY_CHANGED');
    const rows = await data.query(
      `SELECT id FROM support_runs WHERE "caseId"=$1 AND result->'analysis'->>'source'='delayed-test'`,
      [intake.reference],
    );
    assert.equal(rows.length, 0);
  } finally {
    release?.();
    await data.destroy();
  }
});

test('operator routes reject unauthenticated direct access', async () => {
  for (const path of ['/state', '/company', '/company/prompt', '/privacy', '/connections']) {
    assert.equal((await fetch(origin + path)).status, 401);
    assert.equal(
      (await fetch(origin + path, { headers: { 'X-Resolve-Internal': 'wrong' } })).status,
      401,
    );
  }
  assert.equal(
    (
      await fetch(origin + '/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
    ).status,
    401,
  );
});

test('operator credentials do not bypass the origin boundary', async () => {
  assert.equal(
    (
      await fetch(origin + '/state', {
        headers: { 'X-Resolve-Internal': internalToken, Origin: 'https://untrusted.example' },
      })
    ).status,
    403,
  );
});
