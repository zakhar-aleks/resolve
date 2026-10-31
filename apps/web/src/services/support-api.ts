import {
  WorkflowSchema,
  WorkflowPolicySchema,
  type WorkflowCreate,
  type WorkflowPolicy,
} from '@resolve/contracts';
import {
  StateSchema,
  PrivacyProfileSchema,
  PrivacyNoticeSchema,
  IntakeReceiptSchema,
  type PrivacyProfile,
  type CaseUpdateInput,
  type IntakeInput,
  CompanySchema,
  CaseSchema,
  RunSchema,
  OperationSchema,
  ConnectionStatusSchema,
  ConnectionTestSchema,
  type CompanyProfile,
  type ConnectionInput,
  type CreateCaseInput,
} from '@resolve/contracts';
import { apiRequest } from '../wrappers/api-client';
export const supportApi = {
  prepareWorkflow: (input: WorkflowCreate) =>
    apiRequest('/workflows/requests', WorkflowSchema, 'POST', input),
  confirmWorkflow: (id: string, planHash: string, verificationToken: string) =>
    apiRequest(`/workflows/requests/${encodeURIComponent(id)}/confirm`, WorkflowSchema, 'POST', {
      planHash,
      verificationToken,
    }),
  executeWorkflow: (id: string, planHash: string) =>
    apiRequest(`/workflows/requests/${encodeURIComponent(id)}/execute`, WorkflowSchema, 'POST', {
      planHash,
    }),
  reconcileWorkflow: (id: string) =>
    apiRequest(
      `/workflows/requests/${encodeURIComponent(id)}/reconcile`,
      WorkflowSchema,
      'POST',
      {},
    ),
  saveWorkflowPolicy: (policy: WorkflowPolicy) =>
    apiRequest('/workflows/policy', WorkflowPolicySchema, 'PUT', policy),
  state: () => apiRequest('/state', StateSchema),
  saveCompany: (company: CompanyProfile) => apiRequest('/company', CompanySchema, 'PUT', company),
  createCase: (record: CreateCaseInput) => apiRequest('/cases', CaseSchema, 'POST', record),
  analyze: (id: string, message: string) =>
    apiRequest(`/cases/${encodeURIComponent(id)}/analyze`, RunSchema, 'POST', { message }),
  execute: (id: string) => apiRequest(`/runs/${id}/execute`, OperationSchema, 'POST', {}),
  reconcile: (id: string) => apiRequest(`/operations/${id}/reconcile`, OperationSchema, 'POST', {}),
  connect: (input: ConnectionInput) =>
    apiRequest('/connections', ConnectionStatusSchema, 'POST', input),
  testMistral: () => apiRequest('/connections/mistral/test', ConnectionTestSchema, 'POST', {}),
  savePrivacy: (profile: PrivacyProfile) =>
    apiRequest('/privacy', PrivacyProfileSchema, 'PUT', profile),
  notice: () => apiRequest('/privacy/notice', PrivacyNoticeSchema),
  intake: (input: IntakeInput) => apiRequest('/intake', IntakeReceiptSchema, 'POST', input),
  updateCase: (id: string, input: CaseUpdateInput) =>
    apiRequest(`/cases/${encodeURIComponent(id)}`, CaseSchema, 'PATCH', input),
};
