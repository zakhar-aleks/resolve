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
