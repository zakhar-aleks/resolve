import { z } from 'zod';
export const WORKFLOW_KINDS = [
  'change_address',
  'arrange_return',
  'reschedule_appointment',
  'recover_account',
  'update_preferences',
  'privacy_request',
] as const;
export const WorkflowKindSchema = z.enum(WORKFLOW_KINDS);
export type WorkflowKind = z.infer<typeof WorkflowKindSchema>;
const ref = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/u);
export const AddressSchema = z
  .object({
    line1: z.string().trim().min(1).max(180),
    city: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().min(1).max(24),
    country: z
      .string()
      .trim()
      .length(2)
      .regex(/^[a-zA-Z]{2}$/u)
      .toUpperCase(),
  })
  .strict();
export const WorkflowActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('change_address'), resourceId: ref, address: AddressSchema }).strict(),
  z
    .object({
      kind: z.literal('arrange_return'),
      resourceId: ref,
      itemId: ref,
      quantity: z.number().int().min(1).max(10),
      resolution: z.enum(['return', 'replacement']),
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
  z.object({ kind: z.literal('reschedule_appointment'), resourceId: ref, slotId: ref }).strict(),
  z.object({ kind: z.literal('recover_account'), resourceId: ref }).strict(),
  z
    .object({
      kind: z.literal('update_preferences'),
      resourceId: ref,
      marketingEmail: z.boolean(),
      productUpdates: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('privacy_request'),
      resourceId: ref,
      requestType: z.enum(['access', 'erasure']),
    })
    .strict(),
]);
export type WorkflowAction = z.infer<typeof WorkflowActionSchema>;
export const WorkflowCreateSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    mode: z.enum(['demo', 'connector']).default('demo'),
    customerId: ref,
    verificationToken: z.string().min(1).max(2000),
    action: WorkflowActionSchema,
  })
  .strict();
export type WorkflowCreate = z.infer<typeof WorkflowCreateSchema>;
export const WorkflowPolicySchema = z
  .object({
    revision: z.string().min(1),
    enabledActions: z.array(WorkflowKindSchema).max(6),
    maxReplacementCents: z.number().int().min(0).max(100000),
    returnWindowDays: z.number().int().min(1).max(365),
    maxRecoveryPerDay: z.number().int().min(1).max(10),
  })
  .strict()
  .refine((value) => new Set(value.enabledActions).size === value.enabledActions.length);
export type WorkflowPolicy = z.infer<typeof WorkflowPolicySchema>;
export const DEFAULT_WORKFLOW_POLICY: WorkflowPolicy = {
  revision: 'actions-v1',
  enabledActions: [...WORKFLOW_KINDS],
  maxReplacementCents: 5000,
  returnWindowDays: 30,
  maxRecoveryPerDay: 3,
};
export const WorkflowCheckSchema = z
  .object({ code: z.string().min(1).max(100), passed: z.boolean() })
  .strict();
export const WorkflowSchema = z
  .object({
    id: z.string().uuid(),
    mode: z.enum(['demo', 'connector']),
    customerId: z.string(),
    action: WorkflowActionSchema.nullable(),
    summary: z.string().max(2000),
    checks: z.array(WorkflowCheckSchema),
    state: z.enum([
      'blocked',
      'awaiting_confirmation',
      'ready',
      'executing',
      'succeeded',
      'unknown',
      'failed',
    ]),
    planHash: z.string(),
    confirmed: z.boolean(),
    receiptId: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    archivedAt: z.string().datetime().nullable(),
  })
  .strict();
export type Workflow = z.infer<typeof WorkflowSchema>;
export const WorkflowConfirmationSchema = z
  .object({ planHash: z.string().length(64), verificationToken: z.string().min(1).max(2000) })
  .strict();
export const WorkflowExecutionSchema = z.object({ planHash: z.string().length(64) }).strict();
export const ConnectorPreparationSchema = z
  .object({
    planRef: z.string().min(1).max(1000),
    summary: z.string().max(2000),
    checks: z
      .array(WorkflowCheckSchema)
      .min(1)
      .max(50)
      .refine((checks) => new Set(checks.map((check) => check.code)).size === checks.length),
    ownershipVerified: z.boolean(),
    resourceVersion: z.string().min(1).max(200),
    confirmationRequired: z.boolean(),
  })
  .strict();
export const ConnectorOutcomeSchema = z
  .object({
    status: z.enum(['succeeded', 'pending', 'failed']),
    receiptId: z.string().min(1).max(200),
    summary: z.string().max(2000),
  })
  .strict();
export type ConnectorOutcome = z.infer<typeof ConnectorOutcomeSchema>;
export const AgentMessageSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(120),
    message: z.string().trim().min(1).max(4000),
    aiPreference: z.enum(['allowed', 'human_only']).default('human_only'),
  })
  .strict();
export const AgentMessageReceiptSchema = z.object({
  reference: z.string(),
  suggestedAction: WorkflowKindSchema.nullable(),
});
export const WorkflowListSchema = z.array(WorkflowSchema);
const DemoOrderSchema = z.object({
  id: z.string(),
  status: z.enum(['unfulfilled', 'shipped', 'delivered']),
  createdAt: z.string().datetime(),
  address: AddressSchema,
  itemId: z.string(),
  quantity: z.number().int(),
  unitCents: z.number().int(),
  stock: z.number().int(),
  returned: z.number().int(),
  returns: z.array(
    z.object({
      id: z.string(),
      resolution: z.enum(['return', 'replacement']),
      quantity: z.number().int(),
    }),
  ),
});
export const DemoStateSchema = z.object({
  version: z.number().int(),
  customerId: z.string(),
  order: DemoOrderSchema,
  returnOrder: DemoOrderSchema,
  appointment: z.object({
    id: z.string(),
    slotId: z.string(),
    slots: z.array(
      z.object({ id: z.string(), startsAt: z.string().datetime(), available: z.boolean() }),
    ),
  }),
  account: z.object({
    id: z.string(),
    recoveryRequests: z.array(z.object({ id: z.string(), createdAt: z.string().datetime() })),
  }),
  preferences: z.object({
    id: z.string(),
    marketingEmail: z.boolean(),
    productUpdates: z.boolean(),
  }),
  privacyRequests: z.array(
    z.object({
      id: z.string(),
      requestType: z.enum(['access', 'erasure']),
      status: z.literal('awaiting_specialist_review'),
    }),
  ),
});
export type DemoState = z.infer<typeof DemoStateSchema>;
