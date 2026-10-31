export const PRIVACY_COPY = {
  privacy: {
    nav: 'Privacy centre',
    eyebrow: 'PRIVACY & TRUST',
    title: 'Privacy is part of customer care.',
    description:
      'Control how requests are handled, document your responsibilities, and prepare your company for European business use.',
    boundary:
      'This is a readiness workspace, not a GDPR certification. A policy page or completed checklist does not establish compliance.',
    global:
      'Available to customers worldwide. GDPR applies according to the facts of your business and processing—not a customer’s country selection or a waiver.',
    identity: 'Who is responsible for customer data?',
    legalName: 'Company’s legal name',
    address: 'Registered or contact address',
    email: 'Privacy contact email',
    region: 'Business context',
    eea: 'Established in the EEA',
    international: 'International business serving global customers',
    basis: 'Document the lawful basis for support processing',
    bases: {
      undecided: 'Not yet assessed',
      contract: 'Performance of a contract',
      legitimate_interests: 'Legitimate interests · document the assessment',
      consent: 'Consent · document a valid consent process',
    },
    hosting: 'Where is your service hosted?',
    hostingHint:
      'Record the actual hosting location. This setting does not move data or restrict provider locations.',
    processing: 'How customer requests are handled',
    ai: 'Allow external AI assistance',
    aiNote:
      'Off by default. Enabling requires company identity, a privacy contact, a lawful-basis assessment, and documented processor review.',
    redaction: 'Filter common identifiers before external AI calls',
    redactionNote:
      'Filters common email addresses, telephone numbers, and long numbers. This is not full anonymisation; do not submit sensitive or unnecessary information.',
    preference:
      'Human-only preferences always take priority. Turning off optional processing does not waive GDPR or any other mandatory privacy rights.',
    retention: 'Closed conversation retention · days',
    retentionNote:
      'After this period, closed-request names, messages, summaries, tags, and reply drafts are removed from the active database. Closed action-request content is also removed; minimal action references remain. Backup, provider, and statutory retention require a separate policy.',
    save: 'Save privacy settings',
    saved:
      'Privacy settings saved. Open requests will be prepared again under the updated controls.',
    checklist: 'Your European privacy readiness checklist',
    checklistBody:
      'Each item explains the work to complete. Add an accountable owner and an evidence reference. Marking an item means your company attests it has done the work; Resolve has not independently verified it.',
    owner: 'Accountable owner',
    evidence: 'Evidence or document reference',
    confirmed: 'Work completed and evidence recorded',
    launchTitle: 'Before serving real customers',
    launchBody:
      'This MVP does not provide production sign-in, company isolation, or a complete rights-request workflow. Deploy authenticated access, roles, transport/storage security, provider contracts, and reviewed operating procedures before using real customer data.',
    progress: '{complete} of {total} work items documented',
    noticeLink: 'Review your draft privacy notice',
    noticeDraft: 'Draft privacy notice',
    noticeDraftBody:
      'Complete your legal entity, contact, lawful basis, actual hosting, processors, transfer assessment, and operating procedures before publishing this notice.',
    retentionRun: 'Apply retention now',
    retentionDone: 'Retention applied to eligible closed conversations.',
    sources: 'Official guidance',
    policyTitle: 'Privacy notice',
    updated: 'Notice version: 31 October 2026',
    controller: 'Who handles your information',
    contact: 'Contact',
    notProvided: 'Not configured—complete this before publication.',
    dataTitle: 'Information used for customer support',
    dataBody:
      'Support requests may contain your name, message, request tags, assigned support owner, preferences, and linked payment metadata. Resolve does not need a full card number, security code, password, or sensitive personal information to handle a support request.',
    purposeTitle: 'Why information is processed',
    purposeBody:
      'The company uses information to understand and respond to support requests, verify account and payment ownership, apply its customer policies, and keep proportionate records of approved actions. The company must assess and document a lawful basis for each purpose; optional processing must not be bundled into unnecessary conditions of service.',
    aiTitle: 'AI assistance and your choices',
    aiOff:
      'External AI assistance is currently disabled in this workspace. Local preparation rules can still help the support team organise requests.',
    aiOn: 'External AI assistance is enabled. Approved providers may receive the request text and limited billing context to prepare summaries and suggestions. Common-identifier filtering is a safeguard, not a guarantee that all personal information is removed.',
    aiChoice:
      'You may ask the support team to handle your request without external AI. That preference takes priority. If processing relies on consent, you may withdraw that consent; this does not remove processing justified on another applicable lawful basis or the company’s statutory duties.',
    sharingTitle: 'Connected services and international transfers',
    sharingBody:
      'The company may connect Slack for incoming mentions, payment or company service providers for verified billing, order, booking, account and privacy-case actions, and approved AI providers for optional assistance. It must identify its actual processors, enter appropriate contracts, explain recipients and locations, and assess any transfer outside the EEA using an applicable lawful mechanism. Selecting an EEA business context does not guarantee EEA-only processing.',
    retentionTitle: 'How long information is kept',
    retentionTemplate:
      'This workspace removes the content of eligible closed conversations after {days} days. Minimal payment-action records may remain for accountability and legal obligations. The company must define and document separate retention for backups, external providers, unresolved requests, and any statutory records.',
    rightsTitle: 'Your rights and how to exercise them',
    rightsBody:
      'Where applicable, you may request access, rectification, erasure, restriction, portability, or object to processing. Some rights depend on the circumstances and lawful basis. Contact the privacy contact above; identity may need to be verified. You may also complain to the competent supervisory authority. The company must operate a process for handling requests within the applicable time limits.',
    globalTitle: 'Global customers and mandatory protections',
    globalBody:
      'Resolve can be used for global customer support. GDPR scope depends on factors including establishment, offering goods or services to people in the EEA, and monitoring their behaviour. Customers cannot opt out of applicable GDPR protections. Other mandatory local privacy laws may also apply. Optional AI preferences do not change this legal scope.',
    changesTitle: 'Changes and questions',
    changesBody:
      'The company must review this notice when its purposes, providers, locations, or retention change and communicate material changes appropriately. Ask the privacy contact for the current approved notice and supporting information.',
    termsTitle: 'Terms of use',
    termsBody:
      'Resolve is a support-team tool. Your company remains responsible for its customer policies, operator permissions, authorised actions, and lawful data processing. Suggestions need appropriate review, and a Slack mention never authorises a payment action. This demonstration uses test billing records. Mandatory consumer and privacy rights are not excluded by these terms.',
  },
  privacyTasks: {
    scope: {
      title: 'Establish which laws apply and who is responsible',
      action:
        'Map the controller, processors, establishment, customer markets, and any EEA targeting or monitoring. Record the GDPR scope assessment, relevant local laws, and whether a representative or DPO is required.',
      link: 'https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/application-gdpr_en',
    },
    lawful_basis: {
      title: 'Document purposes, lawful bases, and processing records',
      action:
        'List each purpose and data category in your processing record. Assess contract necessity or legitimate interests where appropriate. If relying on consent, implement a valid, separate withdrawal process. Assess automated-decision restrictions.',
      link: 'https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data_en',
    },
    notice: {
      title: 'Approve and publish an accurate privacy notice',
      action:
        'Complete the company identity and contact, purposes, lawful bases, recipients, transfers, retention, rights, complaint route, and any required automated-decision information. Have the notice reviewed and make it available when information is collected.',
      link: 'https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en',
    },
    processors: {
      title: 'Review every service provider and sign required agreements',
      action:
        'Inventory hosting, Slack, billing, and AI providers. Check their roles, security, subprocessors, deletion/retention terms, and processing locations. Execute appropriate Article 28 agreements and record instructions before sending customer information.',
      link: 'https://www.edpb.europa.eu/sme/learn-the-basics/data-controller-or-data-processor_en',
    },
    transfers: {
      title: 'Assess and document international transfers',
      action:
        'Map EEA-to-third-country transfers and remote access. Confirm an applicable adequacy decision or appropriate safeguards, such as SCCs, and assess supplementary measures where needed. Do not assume a European brand means European-only processing.',
      link: 'https://www.edpb.europa.eu/sme/be-compliant/international-data-transfers_en',
    },
    security: {
      title: 'Deploy and verify corporate access and security',
      action:
        'Add authenticated access, company isolation, least-privilege roles, MFA/SSO where appropriate, encryption in transit and at rest, controlled secrets, tested backups, audit access, and an incident process. This local MVP does not implement all of these controls.',
      link: 'https://www.edpb.europa.eu/sme/be-compliant/secure-personal-data_en',
    },
    retention: {
      title: 'Set and test retention across all systems',
      action:
        'Choose justified retention for open and closed conversations, financial evidence, backups, logs, and providers. Test content removal, legal holds, and deletion propagation. The built-in closed-conversation cleanup covers only this active database.',
      link: 'https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en',
    },
    rights: {
      title: 'Operate a verified rights-request process',
      action:
        'Assign a team for access, correction, erasure, restriction, objection, portability, and consent withdrawal. Verify identity proportionately, track applicable response deadlines, and test requests across the database, backups, and providers.',
      link: 'https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en',
    },
    incidents: {
      title: 'Prepare breach assessment and notification procedures',
      action:
        'Keep an incident register and named responders. Assess each incident promptly, notify the authority within 72 hours where required, and inform affected individuals where the applicable high-risk threshold is met. Test the response plan.',
      link: 'https://www.edpb.europa.eu/sme/assess-the-risks/data-breaches_en',
    },
    impact_assessment: {
      title: 'Assess high-risk processing and approve launch',
      action:
        'Screen whether a DPIA is required, particularly for sensitive data, monitoring, scale, or significant automated decisions. Complete the assessment and mitigation where required, consult the authority where necessary, train staff, and obtain the appropriate internal launch approval.',
      link: 'https://www.edpb.europa.eu/topics/accountability-and-compliance-tools/data-protection-impact-assessment_en',
    },
  },
} as const;
