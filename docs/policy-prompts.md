# Policy-aware system prompts and routing

Every external support model call uses a fresh effective system prompt assembled from a fixed support-agent foundation, the saved company policy snapshot, and task-specific output instructions. This is request-time context assembly, not fine-tuning or a change to Mistral’s global settings.

The foundation requires polite, empathetic and truthful support; privacy minimisation; human-only preferences; no passwords/card security codes or unnecessary sensitive information; resistance to customer/Slack/tool prompt injection; and no success claim without verified execution. Company tone and written policies cannot remove these boundaries. Structured backend permissions remain authoritative; written policies may restrict actions further.

## Policy sources and versions

`PolicyContextService` reads company, action-permission and privacy records under consistent PostgreSQL locks. The shared prompt builder includes only relevant processing settings, not readiness-checklist owners/evidence, credentials, or customer records. The effective prompt hash covers the foundation version, company identity/context/written policy, structured billing and action permissions, routing preferences, relevant privacy controls and all source revisions.

Company, action-permission and privacy saves queue open requests for fresh preparation. The triage worker also detects changed prompt hashes, including a changed foundation after deployment. Every run records prompt metadata and routing provenance. Understanding/routing and judgment use one snapshot throughout the run. Each provider checks that the snapshot and customer processing preference are still current before making another external request. A final transaction checks them again before saving the recommendation; stale output is discarded and the open request remains queued.

An already-sent network request cannot be retracted by updating policy. The application prevents subsequent calls and recommendations/actions from using that outdated snapshot. It also cannot revoke an external write already dispatched; operation receipts and reconciliation remain separate from prompt updates.

Pending billing approvals and non-payment action plans are checked against the current effective prompt hash. Completed operations remain recorded, and reconciliation still reads the original outcome rather than making another write. Legacy preparations without prompt metadata require fresh preparation.

## Routing

Slack and authenticated API intake continue to feed the same support preparation service. Privacy checks happen before external routing. Human-only, AI-off and rules-only requests do not call Mistral or Jev. Automatic mode retains local rules when no Mistral connection is configured. An explicitly selected but disconnected Jev integration goes to human review.

The router identifies refund/cancellation requests and the six non-payment scenarios, estimates low/high complexity, identifies policy conflicts and missing essential information, and produces a short summary. Mistral Small is the default external router. Optional Jev mode uses its choice questions for routing and judgment with the same foundation and company context.

`routingMode=small_only` is the default. High complexity, missing evidence and policy conflicts go to human review. With `routingMode=adaptive`, high-complexity work may use `MISTRAL_LARGE_MODEL` only when that model ID and a Mistral key are configured. Missing-information and policy-conflict cases still go to people. There is no automatically enabled larger model or additional provider. Configure an actual model available to the account; availability and quality need credentialed validation.

Models recommend next steps, never execute tools directly. Billing still passes the server’s billing eligibility checks and operator approval. Non-payment recommendations link to the typed workflow, which verifies ownership, policy limits, customer confirmation and approval separately. The model cannot manufacture verified evidence. A policy prompt is a behavioural safeguard, not a replacement for API permissions or database boundaries.

## Inspecting saved instructions

Company & policies contains a collapsed, read-only preview of the saved effective instructions and their source versions. Unsaved text is not represented until Save succeeds. The local operator endpoint is `GET /api/company/prompt`. The authenticated `GET /api/v1/agent/prompt` endpoint requires the reviewer key. Company settings include the complexity-routing choice. Preview rendering escapes policy text; it does not execute embedded markup.

## Validation and optional live evaluation

Automated tests inspect actual outgoing mocked Mistral messages to verify that the system role contains the foundation and current company policy, while customer text is isolated in the user role and account/payment identifiers are excluded from billing facts. Tests cover prompt version changes, routing permission/configuration, provider bypasses, stale-output rejection and action invalidation against PostgreSQL.

`npm run eval:prompts` builds the evaluation script and skips network calls by default. Set `RUN_LIVE_PROMPT_EVALS=1` to authorise five small-model calls against fictional fixtures using the configured Mistral key. Cases cover eligible refunds, written restrictions, customer prompt injection, privacy/secret requests and unsupported completion claims. The script checks expected action choices and prints drafts for manual review of tone, privacy and honesty. Matching an action is not proof of prompt-injection resistance or production safety. No live model evaluation is run automatically in CI.

Official API reference: [Mistral chat messages](https://docs.mistral.ai/studio/conversations/chat-completion). The model’s system message receives the assembled instructions on each call.
