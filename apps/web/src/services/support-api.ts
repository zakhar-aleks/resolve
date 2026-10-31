import {
  StateSchema,
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
};
