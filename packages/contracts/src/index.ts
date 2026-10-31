import { z } from 'zod';

export const ACTIONS = ['refund', 'cancel', 'review', 'request_info'] as const;
export const ActionSchema = z.enum(ACTIONS);
export const CompanyInputSchema = z.strictObject({
  companyName: z.string().trim().min(1).max(80),
  agentName: z.string().trim().min(1).max(60),
  tone: z.enum(['warm', 'direct', 'friendly', 'formal']),
  context: z.string().max(4000),
  writtenPolicy: z.string().max(10000),
  escalationEmail: z.union([z.email(), z.literal('')]),
  refundWindowDays: z.number().int().min(0).max(365),
  maximumPaymentCents: z.number().int().min(0).max(1000000),
  refundsEnabled: z.boolean(),
  cancellationsEnabled: z.boolean(),
  duplicateOnly: z.boolean(),
  reviewAll: z.boolean(),
  decisionEngine: z.enum(['auto', 'rules', 'jev']),
  jevConfidenceThreshold: z.number().min(0.5).max(1),
  revision: z.string().min(1),
});
export const CompanySchema = CompanyInputSchema;
export type CompanyProfile = z.infer<typeof CompanySchema>;
export const ReasonSchema = z.enum(['duplicate', 'requested', 'unknown', 'cancel']);
export const CreateCaseSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(4000),
  amountCents: z.number().int().min(1).max(10000000),
  ageDays: z.number().int().min(0).max(3650),
  reason: ReasonSchema,
});
export type CreateCaseInput = z.infer<typeof CreateCaseSchema>;
export const CaseSchema = CreateCaseSchema.extend({
  id: z.string(),
  customerId: z.string(),
  paymentId: z.string(),
  refundedCents: z.number().int().min(0),
  currency: z.literal('usd'),
  provider: z.enum(['simulator', 'stripe']),
  paymentStatus: z.string(),
  subscriptionStatus: z.enum(['active', 'cancel_at_period_end']),
});
export type SupportCase = z.infer<typeof CaseSchema>;
export const CHECK_IDS = [
  'ownership',
  'authorization',
  'refunds_enabled',
  'duplicate_evidence',
  'payment_completed',
  'refund_window',
  'payment_limit',
  'refundable_balance',
  'currency',
  'cancellation_enabled',
  'active_subscription',
] as const;
export const PolicyCheckSchema = z.object({
  id: z.enum(CHECK_IDS),
  passed: z.boolean(),
  value: z.number().nullable(),
});
export type PolicyCheck = z.infer<typeof PolicyCheckSchema>;
export const AnalysisSchema = z.object({
  intent: z.enum(['refund', 'cancel', 'investigate']),
  summary: z.string(),
  source: z.string(),
});
export type Analysis = z.infer<typeof AnalysisSchema>;
export const DecisionSchema = z.object({
  action: ActionSchema,
  confidence: z.number().min(0).max(1).nullable(),
  risk: z.number().min(0).max(2).nullable(),
  fulfillment: z.number().min(0).max(2).nullable(),
  rationale: z.string(),
  reply: z.string(),
  source: z.string(),
});
export type Decision = z.infer<typeof DecisionSchema>;
export const RunSchema = z.object({
  id: z.uuid(),
  caseId: z.string(),
  message: z.string(),
  company: CompanySchema,
  analysis: AnalysisSchema,
  checks: z.array(PolicyCheckSchema),
  decision: DecisionSchema,
  amountCents: z.number().int().min(0),
  elapsedMs: z.number(),
  createdAt: z.iso.datetime(),
});
export type SupportRun = z.infer<typeof RunSchema>;
export const OperationStateSchema = z.enum([
  'dispatched',
  'unknown',
  'pending',
  'succeeded',
  'failed',
  'canceled',
]);
export type OperationState = z.infer<typeof OperationStateSchema>;
export const ReceiptSchema = z.object({
  id: z.string(),
  status: z.string(),
  provider: z.enum(['simulator', 'stripe']),
  amountCents: z.number().int().nullable(),
});
export type Receipt = z.infer<typeof ReceiptSchema>;
export const OperationSchema = z.object({
  id: z.uuid(),
  runId: z.uuid(),
  caseId: z.string(),
  action: z.enum(['refund', 'cancel']),
  state: OperationStateSchema,
  amountCents: z.number(),
  receipt: ReceiptSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type BillingOperation = z.infer<typeof OperationSchema>;
export const EventSchema = z.object({
  id: z.uuid(),
  operationId: z.uuid(),
  state: OperationStateSchema,
  code: z.enum([
    'prepared',
    'committed',
    'response_lost',
    'reconciled',
    'provider_response',
    'provider_uncertain',
  ]),
  createdAt: z.iso.datetime(),
});
export type ActionEvent = z.infer<typeof EventSchema>;
export const ConnectionStatusSchema = z.object({
  mistral: z.boolean(),
  jev: z.boolean(),
  stripe: z.boolean(),
  model: z.string(),
});
export const StateSchema = z.object({
  company: CompanySchema,
  cases: z.array(CaseSchema),
  runs: z.array(RunSchema),
  operations: z.array(OperationSchema),
  events: z.array(EventSchema),
  connections: ConnectionStatusSchema,
});
export type AppState = z.infer<typeof StateSchema>;
export const AnalyzeSchema = z.strictObject({ message: z.string().trim().min(1).max(4000) });
export const ConnectionInputSchema = z.strictObject({
  provider: z.enum(['mistral', 'jev']),
  key: z
    .string()
    .trim()
    .min(10)
    .max(1000)
    .refine((s) => !/[\s*]/u.test(s)),
});
export type ConnectionInput = z.infer<typeof ConnectionInputSchema>;
export const ConnectionTestSchema = z.object({ ok: z.boolean(), modelAvailable: z.boolean() });
export const IdSchema = z.uuid();
export const ErrorSchema = z.object({ code: z.string(), message: z.string() });
export const DEFAULT_COMPANY: CompanyProfile = {
  companyName: 'Acme',
  agentName: 'Resolve',
  tone: 'warm',
  context: 'A subscription software company.',
  writtenPolicy: '',
  escalationEmail: '',
  refundWindowDays: 30,
  maximumPaymentCents: 10000,
  refundsEnabled: true,
  cancellationsEnabled: true,
  duplicateOnly: true,
  reviewAll: false,
  decisionEngine: 'auto',
  jevConfidenceThreshold: 0.8,
  revision: 'billing-v1',
};
