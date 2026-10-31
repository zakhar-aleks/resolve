# European privacy readiness

The Privacy centre is a work tracker and processing control, not a certification. The privacy notice is a draft until the company completes and reviews its actual details. Global use is supported; there is no switch that waives applicable GDPR obligations.

Before real customer use, complete the ten tasks in the Privacy centre with an owner and evidence: scope and roles; purposes, lawful bases and records; notice; processor agreements; transfers; security; retention; rights; incident response; and DPIA screening. Each task links to European Commission or EDPB guidance. Corporate authentication, tenant isolation, roles, deployment security, verified rights workflows, and operational approval remain launch requirements.

External AI is off by default. Enabling it requires identity, contact, lawful basis, and recorded processor review. A human-only preference bypasses both Mistral and Jev. Common identifier filtering is not full anonymisation. Only limited billing facts are sent to model providers; account/payment IDs and customer names are excluded from billing context. Free text and company policies may still contain personal data.

The worker checks closed-conversation retention every minute, in batches of 50. It removes names, customer messages, summaries, tags, owners, customer/payment linkage and run reply/rationale content from eligible closed conversations in the active database. Unresolved billing operations prevent cleanup. Minimal action receipts and events remain. This does not delete provider copies, logs or backups, and it is not a complete erasure-request process. Administrators must define financial-record, backup, provider and legal-hold retention separately.

Official references: [GDPR scope](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/application-gdpr_en), [EDPB small business guide](https://www.edpb.europa.eu/sme-data-protection-guide/home_en).
