# Signup and agent action plan

Status: proposed product design, not an implemented signup flow. The current application is a local single-company demonstration with no accounts, authenticated sessions, or tenant isolation. Existing privacy settings do not make it suitable for production signup or real customer data.

## Two distinct journeys

The company creates and administers a Resolve workspace. Its customers contact support through a form or a connected channel; they should not need a Resolve account merely to ask for help. Account ownership must be verified separately before an action touches their account.

Resolve must explain its own account-data processing at signup. Each company must also explain its customer-support processing at intake. The company is generally controller for its support data and Resolve would generally act as processor under documented instructions; actual roles depend on the processing. Resolve may separately be controller for its own business account administration.

## Proposed company signup

1. **Create the administrator account.** Collect only required account details. Show the Resolve privacy notice before submission. Record terms acceptance with version and timestamp; do not describe acceptance of a privacy notice as blanket consent. Keep optional marketing separate and unchecked.
2. **Verify the administrator.** Verify email or corporate identity. Establish secure sessions, recovery, rate limits, and administrative MFA. Create the company boundary and membership on the server; never trust a tenant ID supplied by the browser.
3. **Create the company workspace.** Record legal entity, business context, privacy contact, and controller/processor responsibilities. Explain that international use does not switch off applicable GDPR rights.
4. **Configure processing before connecting data.** Establish support purposes and lawful bases, retention, processor agreements, actual hosting and transfer arrangements, and an accurate company notice. Review the DPA with Resolve and applicable subprocessors. External AI stays off until the company explicitly configures it and completes the prerequisite review. A region selector must never masquerade as a data-residency control.
5. **Connect services with limited permissions.** Explain the data each connection reads, the actions it can perform, its recipients, and how to disconnect it. Configure read and write scopes separately. Invite staff with roles: administrator, support agent, and reviewer.
6. **Test and activate.** Use synthetic requests to verify permissions, human-only preferences, retention, and approval limits. Enforce launch prerequisites in the backend. Store configuration versions and accountable approval; a checklist alone is not proof of legal compliance.

The administrator can explore a fictional demo before completing these steps. Real customer intake, imports, external AI, and external writes remain gated independently by their prerequisites. Account creation itself needs appropriate privacy controls; it cannot wait for step four.

## Proposed customer intake

Present the company’s notice at collection, minimise fields, discourage sensitive information, and offer human-only handling without making support conditional on optional AI. Carry that preference through summaries, connected services, and future messages. Distinguish a support preference from a lawful basis or valid consent record. Implement verified requests for rights, separate from the agent’s normal account actions. Do not advertise a GDPR opt-out.

## Enforcement to build next

- Authenticated, tenant-scoped API access and database isolation, including background jobs, exports and integration callbacks.
- Server-side onboarding state and processing permissions; disabled controls in the UI are insufficient.
- Purpose-specific notice, terms, consent where appropriate, and DPA version records with timestamps; withdrawal must be as easy as giving consent.
- Restricted integration credentials, per-action permissions, reviewer roles, and a durable audit trail.
- Rights-request identity verification, deadlines, export/deletion review, backup/provider propagation, and legal-hold handling.
- Tests for cross-company reads/writes, disabled processing, revoked integrations, policy changes, and customer preference enforcement.

## Actions beyond payments

These are proposed adapters and workflows, not current integration capabilities.

| Area                | Customer problem                 | Agent action                                                                 | Required boundary                                                                              |
| ------------------- | -------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Orders              | Incorrect delivery address       | Update an unfulfilled order’s address                                        | Verify order ownership, validate address, recheck fulfilment status, customer confirmation     |
| Delivery            | Parcel arrived damaged           | Create a replacement or return label                                         | Confirm eligible item/evidence, stock and value limits, reviewer approval where needed         |
| Account access      | Cannot sign in                   | Trigger the identity provider’s recovery process                             | Never expose passwords or let the agent bypass identity verification                           |
| Account preferences | Too many messages                | Unsubscribe from optional marketing or update notification preferences       | Verify the account, keep necessary service messages separate, propagate to the source system   |
| Service operations  | Service is unavailable           | Open an incident and attach relevant diagnostics                             | Filter diagnostic data, scope visibility, do not promise a fix before confirmation             |
| Scheduling          | Needs to change a booking        | Reschedule or cancel an appointment                                          | Check availability, time zone and cancellation policy; confirm the exact change                |
| Team coordination   | Request needs a specialist       | Assign a ticket, add tags, escalate with a short brief                       | Approved destination and minimum necessary customer context                                    |
| Documents           | Needs an invoice or receipt      | Retrieve the permitted document and deliver through an approved channel      | Verify ownership and recipient; avoid exposing unrelated financial records                     |
| Privacy requests    | Wants a copy or deletion of data | Open and track a verified rights request; prepare an export or deletion plan | Human review, identity checks, lawful exceptions and holds; no automatic irreversible deletion |

Recommended next vertical: order address changes and replacement requests. They demonstrate useful non-payment writes with clear before/after outcomes. The choice still requires an actual order-system connection; no provider is selected here.

## Shared action lifecycle

Each action declares its input/result schema, required connection scope, evidence, company policy, approval rule, and verification method. The lifecycle is: understand → verify ownership/evidence → prepare a concrete change → obtain required approval → execute once → read back the result → record the outcome. Use idempotency where supported; otherwise use a durable operation identity, concurrency controls and provider-specific reconciliation. A timeout means unknown until reconciled, never permission to repeat a write blindly.

Current implementation already provides local tagging, ownership, request states, summaries, and human-only preferences. It also supports simulated billing operations and an optional Stripe test adapter. External replies remain drafts; Slack currently provides inbound mentions only. All proposed order, identity, booking, document-delivery and rights-processing actions require new adapters and tests.

## Official reference

The [EDPB overview of data protection by design and default](https://www.edpb.europa.eu/system/files/2026-02/edpb-summary-gdpr-data-protection-design-default_en.pdf) supports building privacy into the beginning and lifecycle of processing. The [European Commission’s lawful-basis guidance](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data_en) explains why unnecessary processing must not be bundled into service conditions. These are design inputs; the actual business and deployment need their own assessment.
