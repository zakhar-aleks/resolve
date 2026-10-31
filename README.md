# Resolve

A configurable customer-support agent that evaluates company policy and executes auditable billing actions.

**Frontend:** Astro SSR, HTMX, Tailwind CSS 4, strict TypeScript.  
**Backend:** Node.js, NestJS, TypeORM, PostgreSQL.  
**Models:** Mistral Small 4; Jev is optional.

## Start locally

Requires Node.js 24+, npm, and PostgreSQL 16+ (or Docker).

```sh
npm ci
npm run db:start
npm run dev
```

Open [localhost:8787](http://127.0.0.1:8787). NestJS listens on loopback port 8788; PostgreSQL uses 55432. `db:start` initializes an isolated project cluster in `.runtime/`, creates the database, and leaves system PostgreSQL installations alone. Use `npm run db:stop` to stop this cluster. If your execution sandbox blocks PostgreSQL shared memory, run `db:start` in your regular terminal.

Docker alternative:

```sh
docker compose up -d postgres
npm run dev
```

For existing PostgreSQL, copy `.env.example` to `.env` and set `DATABASE_URL`. TypeORM runs explicit migrations on startup; schema synchronization is disabled. Fixture seeding is idempotent.

Production build, running locally:

```sh
npm run build
# Terminal 1
npm run start -w @resolve/api
# Terminal 2
HOST=127.0.0.1 PORT=8787 npm run start -w @resolve/web
```

## Workspace structure

```text
apps/
  api/src/
    company/         # company settings API and revision checks
    connections/     # process-memory provider credentials
    support/
      domain/        # pure policy evaluation
      providers/     # typed Mistral / Jev adapters
    billing/
      domain/        # receipt-state rules
      mappers/       # entity → API serialization
    database/
      entities/      # explicit TypeORM models
      migrations/    # schema, constraints, indexes
    common/
      filters/       # sanitized API errors
      http/          # validated provider HTTP wrapper
      middleware/    # loopback host/origin boundary
      pipes/         # runtime request validation
  web/src/
    consts/copy/      # all UI copy, organized by feature
    components/      # Astro markup only
    layouts/         # document shell and bundled client entry
    pages/           # thin full-page / fragment / action routes
    services/        # server API adapters, actions, display view models
    helpers/         # form mapping, routes, copy interpolation
    utils/           # formatting and typed interpolation
    wrappers/        # validated server HTTP boundary
    types/           # frontend presentation contracts
    scripts/         # HTMX setup and DOM event wiring
    styles/          # semantic components using @apply and @utility
packages/contracts/  # shared Zod schemas and inferred TypeScript types
```

Astro renders full pages and HTML fragments. HTMX navigates and submits forms to Astro action routes; those routes call NestJS using shared runtime-validated contracts. The API remains JSON-only. Forms also work with full-page submissions when JavaScript is unavailable.

Business policy is enforced in Nest's domain/execution layer. Astro components never authorize payments. Data preparation and rendering are separate. All UI copy lives in feature constants; dynamic templates use a typed interpolation utility. Semantic CSS classes keep Tailwind class lists out of templates.

## Code quality

```sh
npm run check             # strict TS, Astro diagnostics, ESLint, Prettier
npm test                  # pure domain tests
npm run test:integration  # real PostgreSQL/API concurrency and recovery tests
npm run build             # contracts, NestJS, Astro SSR production bundles
npm run format
```

TypeScript enables `strict`, unchecked-index protection, exact optional properties, and unused-code checks. ESLint rejects explicit `any`, expression non-null assertions, and inline visible Astro copy. Type-only imports preserve Nest decorator injection metadata. Shared Zod schemas reject extra request properties and validate provider responses.

PostgreSQL integration tests create and destroy a uniquely named test database; they do not clear your workspace database. The test connection needs permission to create databases. They verify migrations, settings persistence, stale approvals, validation, concurrent refunds, replay, uncertain-outcome recovery, and secret non-disclosure.

## Configure a company

In **Company & policies**, set the identity, agent voice, product context, written policy, escalation contact, and action controls. Import `.txt` / `.md` documents up to 10,000 characters. Saving creates a policy revision; unexecuted decisions from older revisions must be analyzed again.

Structured controls enforce refund windows, maximum eligible payment, duplicate evidence, action permissions, and mandatory review. Written policy guides model judgment; arbitrary prose is not compiled into guaranteed code enforcement. Without a judgment model, written policy routes actions to review.

**Automatic:** Mistral handles language and judgment when configured, otherwise local rules.  
**Rules only:** no model calls or model credits; evaluates structured fixture evidence.  
**Jev:** optional specialized judgments, requiring a TypeSafe key and credits.

## Models and credentials

Use **Connections** to configure a full Mistral secret and test access. Secrets entered in the UI remain in NestJS process memory, are not returned in API state, and disappear on restart. To persist configuration, use `.env`.

Mistral shows the full key once in its creation dialog. A masked key-list value cannot recover it. If you missed the secret, create a new key and copy it immediately.

The default model is `mistral-small-2603`. Mistral-only analysis uses separate understanding and judgment calls. Provider failures do not silently authorize an action through a fallback. Model scores are predictions; Jev confidence thresholds require calibration before operational use.

- [Mistral Small 4](https://docs.mistral.ai/models/mistral-small-4-0-26-03)
- [Mistral API keys](https://docs.mistral.ai/admin/identity-access/api-keys)
- [Jev API](https://docs.typesafe.ai/introduction/quickstart)

## Billing behavior

Demo actions update PostgreSQL billing records, not financial accounts. Try a duplicate refund, an amount/window violation, an unclear charge, period-end cancellation, or **Interrupted refund** → execute → reconcile. Custom test requests create synthetic records only.

Execution saves an operation before dispatch, rechecks current policy and billing state, and serializes preparations with PostgreSQL row locks. Unique indexes prevent multiple unresolved operations per case and repeated operations for one run. Reconciliation checks the original provider receipt without dispatching another write. A process crash without an identifiable receipt remains blocked for manual investigation.

To enable an existing successful USD Stripe test payment, configure:

```text
STRIPE_SECRET_KEY=sk_test_...
STRIPE_TEST_CUSTOMER_ID=cus_...
STRIPE_TEST_PAYMENT_INTENT_ID=pi_...
```

Restart. The server verifies test mode and customer ownership before adding the connected case. Disable the duplicate-only restriction to test an ordinary eligible refund. Refund submissions use persistent operation IDs as Stripe idempotency keys. Pending, failed, and unknown outcomes never count as confirmed success. Live Stripe keys are rejected. Stripe subscription/uncaptured-payment cancellation is not implemented; subscription cancellation is simulator-only.

This is a **local single-company operator MVP**. Customer replies are drafts, and external email/helpdesk delivery is not connected. Production authentication, tenant isolation, deployment secret storage, background reconciliation scheduling, and calibrated model evaluations remain future work. Live model/payment calls require credentialed validation.

## Product experience

`/` is the public landing page. `/?view=support` opens the team inbox, and `/request-support` accepts a fictional customer request with an external-AI preference. Incoming requests are prepared by a PostgreSQL-backed worker automatically; important billing actions still require operator approval. Requests support tags, ownership, and open/waiting/resolved states. Unlinked requests cannot authorise billing actions.

`/?view=privacy` contains company identity, processing preferences, retention, and ten evidence-backed readiness tasks. `/privacy-policy` renders a draft notice from those settings without exposing internal checklist notes. See [privacy readiness](docs/privacy-readiness.md) for scope and remaining production work.

## Slack intake

Create an internal Slack app using `integrations/slack-manifest.yml`, install it in the intended workspace, and generate an app-level token with `connections:write`. Set `SLACK_APP_TOKEN`, `SLACK_TEAM_ID`, and comma-separated `SLACK_CHANNEL_IDS` on the backend and restart it. Invite the app to each approved channel. Mention `@Resolve` with a support request; add `#human-only` to disable external AI for it.

The official Socket Mode SDK receives mentions without a public webhook. Workspace/channel allowlists, bot rejection and a unique event identity prevent unintended intake and duplicate cases. Events are acknowledged after durable insertion. Mentions do not establish account ownership or permit payment actions. Optional SLACK_BOT_TOKEN enables threaded acknowledgements without echoing customer text. This adapter needs real Slack credentials for a live connection test; the demo runs without them.

## Six non-payment actions and Agent API

Open `/?view=workflows` for delivery address changes, returns/replacements, appointment changes, account recovery, notification preferences and reviewed privacy requests. All six change durable fictional service records with policy/evidence checks and explicit approval. They are not pretend receipts for real services.

Run `npm run agent:keys`, restart the API, and use `/api/v1/agent` with separate intake and reviewer Bearer credentials. `GET /schema` supplies OpenAPI 3.1. The optional HTTPS company connector provides live execution and read-only reconciliation. See [the API, service connector, and Slack guide](docs/agent-api.md) for schemas, examples, permissions and deployment requirements. Slack mentions now identify these workflows; an optional bot token enables a threaded acknowledgement.

## Live policy prompts and complexity routing

Saved company, action-permission and privacy settings now compose the system instructions sent to Mistral. A fixed foundation emphasises polite support, privacy, security and verified outcomes. Company & policies includes a read-only preview. Every run records the policy snapshot hash, and policy changes invalidate unexecuted recommendations and action plans.

Small-model routing is the default; complex requests go to the support team unless the company enables adaptive routing and an administrator configures `MISTRAL_LARGE_MODEL`. Jev remains optional, and human-only / AI-off / rules-only processing bypasses all external routing. See [policy prompts and evaluation](docs/policy-prompts.md) for behaviour, concurrency handling and opt-in live tests.

## Workspace security boundary

Run `npm run agent:keys` to generate the workspace password and internal API token as well as scoped Agent API keys. Restart both services after changing credentials. The workspace uses HTTP Basic authentication with username `resolve` and `WORKSPACE_PASSWORD` from ignored `.env`. No password is printed or sent to model providers. Missing/short configuration fails closed. Use HTTPS for remote access; Basic authentication is a temporary single-operator demo gate, not staff accounts or tenant isolation.

Only the landing page, privacy notice, terms and built assets are public. Intake, API documentation, workspace views, fragments and every action require authentication. Mutations require the configured `WEB_ORIGIN`; configure the exact public HTTPS origin before deployment. Nest operator APIs additionally require `X-Resolve-Internal` using `INTERNAL_API_TOKEN`, which Astro adds only on server requests. Agent routes retain separate intake/reviewer Bearer checks. Nest remains on loopback; do not expose it or forward operator routes publicly. Keep database ports private.

Security headers prevent embedding and restrict scripts/resources to this origin. Provider HTTP redirects are rejected. API-wide requests are limited to 600/minute and message intake to 20/minute per process (shared fixed windows); use a trusted gateway with per-client limits before public deployment or scaling. Credentials are shared demo secrets: revoke by rotation and restart. Named users, MFA, tenant isolation, managed secrets, monitoring and independent security review remain outstanding.

## Docker deployment

For a protected DigitalOcean/Debian demo with automatic HTTPS, use [the deployment guide](docs/deployment.md). `Dockerfile` builds a non-root Debian-based app image; `compose.deploy.yaml` runs it with private PostgreSQL and Caddy. Only ports 80/443 are published. `compose.yaml` remains the local-development database configuration.
