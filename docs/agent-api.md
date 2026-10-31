# Company-scoped API update

For signed-in company owners, generate/rotate credentials under **Account & team**. These keys select only that company database. The deployed HTTPS base URL is `https://YOUR_DOMAIN/api/v1/agent`; Astro forwards only this authenticated namespace and does not attach operator secrets or browser sessions. Browser cross-origin calls are not enabled; use a server-side client. Legacy `.env` Agent keys belong only to the explicit local demo mode. See [accounts and encryption](accounts-and-encryption.md).

# Agent API and six support actions

Implemented: typed request preparation, persisted workflows and receipts, policy gates, customer confirmation, reviewer approval, idempotency, single dispatch, read-only reconciliation, and six working PostgreSQL demo actions. Real companies connect their systems through the HTTPS connector contract below. No live order, booking, identity, or messaging credentials are included.

## Run and authenticate

Run `npm run agent:keys` once, then restart the backend. Distinct intake and reviewer credentials are generated in ignored `.env`; existing non-empty values are preserved. Keys must each contain at least 32 characters and must differ. They are never returned to the browser or state API.

Base URL: `http://127.0.0.1:8788/api/v1/agent`. Every endpoint requires `Authorization: Bearer <key>`. The intake key (`RESOLVE_API_KEY`) allows reads, messages, preparation and customer confirmation with a verification proof. The reviewer key (`RESOLVE_REVIEWER_KEY`) additionally allows execution, reconciliation and policy changes. The API returns 503 until both keys are configured, 401 for invalid or insufficient credentials, and 409 for stale or unapproved plans.

`GET /schema` returns the OpenAPI 3.1 description and JSON Schemas. `GET /capabilities` lists actions. `GET /requests` returns at most 100 recent workflows. `GET /requests/:id` reads one result. `GET /demo` reads only fictional demo resources. `GET /policy` and reviewer-only `PUT /policy` manage enabled actions, value limits, return windows and recovery limits using revision checks.

This remains a single-workspace API. The loopback listener and local host/origin boundary remain enabled. The Astro HTTPS gateway forwards only `/api/v1/agent/**`, with the caller’s scoped Bearer credential; it does not expose operator routes. Keep the existing operator routes private. Add rate limits and managed credentials; account authentication, tenant isolation, roles tied to named staff, and production deployment review are still needed before multi-company use.

## Message intake

`POST /messages` accepts `{name,title,message,aiPreference}`. A new message receives automatic preparation, with a suggested workflow in the response. It does not establish ownership or authorise a write. Human-only is the default API preference.

## Prepare a concrete action

`POST /requests`:

```json
{
  "idempotencyKey": "c6b778b6-4ad7-4aaf-93b9-f87e54ad58ab",
  "mode": "demo",
  "customerId": "customer_demo",
  "verificationToken": "demo-customer-verification",
  "action": {
    "kind": "change_address",
    "resourceId": "order_demo",
    "address": {
      "line1": "20 Example Road",
      "city": "Berlin",
      "postalCode": "10115",
      "country": "DE"
    }
  }
}
```

The verification string above is a public **fictional demo proof**, never a valid proof for a connected customer. The UI uses it only for demo records. Live verification tokens are transient and forwarded only to the configured company connector; raw tokens are not persisted in workflow results. Reusing an idempotency key with changed input returns a conflict. The response contains checks, the exact action, state, and a `planHash`; it does not expose the connector’s private plan reference.

Other action objects:

```json
{"kind":"arrange_return","resourceId":"return_order_demo","itemId":"item_demo","quantity":1,"resolution":"replacement","reason":"Damaged item"}
{"kind":"reschedule_appointment","resourceId":"appointment_demo","slotId":"slot_morning"}
{"kind":"recover_account","resourceId":"account_demo"}
{"kind":"update_preferences","resourceId":"customer_demo","marketingEmail":false,"productUpdates":false}
{"kind":"privacy_request","resourceId":"customer_demo","requestType":"erasure"}
```

Returns also accept `resolution: "return"`. Privacy requests also accept `requestType: "access"`. Demo address changes use an unfulfilled order; demo returns use a separate delivered order. Appointment slots are seeded in the future. Preferences change only optional marketing/product messages. Account recovery records a demo provider request; it does not send an email or return a password/reset token. Privacy actions open cases with `awaiting_specialist_review`, without exporting or deleting personal data.

## Confirm, approve, and check

1. If state is `blocked`, resolve the failed evidence or policy check; there is no force flag.
2. If state is `awaiting_confirmation`, call `POST /requests/:id/confirm` with `{planHash,verificationToken}`. The exact prepared change must be confirmed by the verified customer workflow; an operator checkbox is not a live identity check.
3. Use the reviewer credential for `POST /requests/:id/execute` with `{planHash}`. The server rechecks policy and privacy revisions. Demo resources are locked and version checked. Preparations expire after 15 minutes.
4. Read the resulting receipt. Concurrent execution of the same plan changes demo records only once. A connector operation is atomically claimed once before dispatch.
5. An interrupted connection becomes `unknown`. Use reviewer-only `POST /requests/:id/reconcile`; it only reads the provider’s saved operation result. It never repeats a write. Never create a fresh idempotency key to retry an uncertain action.

Completed/blocked/failed workflow content is removed under closed-conversation retention, including action payload, customer reference, checks and private plan reference. Minimal operation identity, hashes and receipt references remain. Pending/unknown operations are retained for reconciliation. Backup and provider retention still need separate policies.

## Company HTTPS connector

Set `SERVICE_CONNECTOR_URL` to a trusted HTTPS base URL and `SERVICE_CONNECTOR_TOKEN` to its credential. URLs with embedded credentials, query strings or fragments are rejected; redirects are disabled. Every request uses a Bearer header. Requests time out after eight seconds. Demo operations never call this service.

Live preparation also requires completed company identity, privacy contact and lawful-basis settings, plus documented processor, notice and security review. These are prerequisite gates, not certification. Enabling external AI is separate from connecting operational services.

The bridge must implement:

- `POST /prepare`: receives the operation ID, typed request (including transient customer proof), and company policy. Verify the proof against the actual customer and resource, read authoritative current data, and return `{planRef,summary,ownershipVerified,resourceVersion,confirmationRequired,checks}`. `planRef` must bind customer, exact action, resource revision, policy, expiry and verification. A preparation must not perform the requested write.
- `POST /confirm`: receives `{planRef,verificationToken}`. Verify the customer’s confirmation of the exact change. Return `{confirmed}`. Do not treat any arbitrary string or client-supplied boolean as verification.
- `POST /execute`: receives `{operationId,idempotencyKey,planRef,planHash}`. Require the verified plan, recheck ownership/resource state, policy, consent/confirmation and expiry, execute with provider idempotency where available, and save the provider result durably.
- `GET /operations/:operationId`: return the saved authoritative outcome `{status,receiptId,summary}` where status is `succeeded`, `pending`, or `failed`. An HTTP success alone is not evidence of a completed business action. Resolve reads this endpoint after dispatch before confirming success.

Required check codes are `resource_found` for every action; additionally `order_unfulfilled` for address changes; `order_delivered`, `eligible_quantity`, `within_return_window`, `value_limit`, `stock_available` for returns; `slot_available` for appointments; and `recovery_rate_limit` for recovery. Missing checks fail closed. The server separately enforces `ownership_verified` and its enabled-action policy. Additional failed connector checks also block preparation.

The bridge is trusted integration code, not an LLM tool that can invent evidence. Implement adapters there for your actual commerce, booking, identity and preference systems. Identity recovery must trigger the existing identity provider’s flow without returning credentials. Privacy export/erasure must create an appropriately reviewed rights workflow, including identity verification, exceptions/holds and downstream handling; this action does not perform irreversible deletion.

Connector mode is only available through the authenticated API. The unauthenticated local demo UI cannot execute or list connector workflows. If a live connector is configured, policy changes also require the reviewer API.

## Tag Resolve in Slack

Use `integrations/slack-manifest.yml`, install the app, create an app-level token with `connections:write`, and invite Resolve to approved channels. Configure `SLACK_APP_TOKEN`, `SLACK_TEAM_ID`, and comma-separated `SLACK_CHANNEL_IDS`. Optional `SLACK_BOT_TOKEN` with `chat:write` enables one threaded acknowledgement for a newly inserted mention. It includes a workflow hint and inbox link, without echoing customer text or credentials.

Examples: `@Resolve please change my delivery address`, `@Resolve the item arrived damaged`, `@Resolve reschedule my appointment`, `@Resolve I cannot sign in`, `@Resolve unsubscribe me from marketing`, `@Resolve I need an export of my personal data`. Add `#human-only` to prevent external AI processing.

The allowlist, bot rejection and unique event identity apply to intake. Mentions create unlinked support requests; they never carry account ownership or approval authority. Do not paste verification tokens, API keys, passwords or sensitive customer information in Slack. A team member or authenticated API client supplies verified structured details through the action workflow. Acknowledgements are best effort: an interruption between durable intake and posting may leave no acknowledgement, and no automatic resend risks duplicating a message. Live Slack transport requires credentialed validation; no real Slack message was sent during development.
