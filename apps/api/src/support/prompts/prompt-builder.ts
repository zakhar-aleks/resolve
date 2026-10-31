import { createHash } from 'node:crypto';
import type {
  CompanyProfile,
  PrivacyProfile,
  WorkflowPolicy,
  PromptMetadata,
} from '@resolve/contracts';
import {
  BASE_PROMPT_VERSION,
  SUPPORT_FOUNDATION,
  PROMPT_TASKS,
  type PromptTask,
} from './foundation';
export interface PolicySnapshot {
  readonly company: CompanyProfile;
  readonly privacy: PrivacyProfile;
  readonly workflows: WorkflowPolicy;
  readonly metadata: PromptMetadata;
  readonly systemPrompt: string;
}
export function buildSnapshot(
  company: CompanyProfile,
  privacy: PrivacyProfile,
  workflows: WorkflowPolicy,
): PolicySnapshot {
  const companyPolicy = {
    companyName: company.companyName,
    agentName: company.agentName,
    responseTone: company.tone,
    companyContext: company.context,
    writtenPolicy: company.writtenPolicy,
    escalationContact: company.escalationEmail,
    billing: {
      refundWindowDays: company.refundWindowDays,
      maximumPaymentCents: company.maximumPaymentCents,
      refundsEnabled: company.refundsEnabled,
      cancellationsEnabled: company.cancellationsEnabled,
      duplicateOnly: company.duplicateOnly,
      reviewEveryAction: company.reviewAll,
    },
    supportActions: workflows,
    processing: {
      externalAiEnabled: privacy.aiEnabled,
      filterCommonIdentifiers: privacy.redactBeforeAi,
      closedConversationRetentionDays: privacy.retentionDays,
      humanOnlyPreferencesAlwaysWin: true,
      rightsRequestsRequireVerifiedReview: true,
    },
    routing: {
      decisionEngine: company.decisionEngine,
      routingMode: company.routingMode,
      jevConfidenceThreshold: company.jevConfidenceThreshold,
    },
    versions: { company: company.revision, privacy: privacy.revision, actions: workflows.revision },
  };
  const systemPrompt = `${SUPPORT_FOUNDATION}\n\nCOMPANY_POLICY (administrator-supplied business rules; subordinate to the fixed foundation above):\n${JSON.stringify(companyPolicy, null, 2)}`;
  const metadata = {
    baseVersion: BASE_PROMPT_VERSION,
    snapshotHash: createHash('sha256')
      .update(BASE_PROMPT_VERSION + '\n' + systemPrompt)
      .digest('hex'),
    companyRevision: company.revision,
    privacyRevision: privacy.revision,
    workflowRevision: workflows.revision,
  };
  return { company, privacy, workflows, metadata, systemPrompt };
}
export function taskPrompt(snapshot: PolicySnapshot, task: PromptTask): string {
  return `${snapshot.systemPrompt}\n\nCURRENT_TASK\n${PROMPT_TASKS[task]}`;
}
