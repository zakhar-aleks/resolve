import { z } from 'zod';
export const PromptMetadataSchema = z
  .object({
    baseVersion: z.string(),
    snapshotHash: z.string(),
    companyRevision: z.string(),
    workflowRevision: z.string(),
    privacyRevision: z.string(),
  })
  .strict();
export type PromptMetadata = z.infer<typeof PromptMetadataSchema>;
export const PromptPreviewSchema = z
  .object({
    metadata: PromptMetadataSchema,
    systemPrompt: z.string(),
    smallModel: z.string(),
    largeModel: z.string().nullable(),
    routingMode: z.enum(['small_only', 'adaptive']),
  })
  .strict();
export type PromptPreview = z.infer<typeof PromptPreviewSchema>;
export const ScenarioSchema = z.enum([
  'refund',
  'cancel',
  'change_address',
  'arrange_return',
  'reschedule_appointment',
  'recover_account',
  'update_preferences',
  'privacy_request',
  'investigate',
]);
export const RoutingAnalysisSchema = z
  .object({
    scenario: ScenarioSchema,
    complexity: z.enum(['low', 'high']),
    summary: z.string().max(1000),
    policyConflict: z.boolean(),
    missingInformation: z.array(z.string().max(200)).max(5),
  })
  .strict();
export type RoutingAnalysis = z.infer<typeof RoutingAnalysisSchema>;
export const RoutingSchema = z
  .object({
    scenario: ScenarioSchema,
    complexity: z.enum(['low', 'high']),
    destination: z.enum(['local', 'small', 'large', 'jev', 'human']),
    model: z.string().nullable(),
    reason: z.enum([
      'standard',
      'complex',
      'policy_conflict',
      'missing_information',
      'human_only',
      'ai_disabled',
      'rules_only',
      'provider_unavailable',
      'large_disabled',
      'large_unavailable',
      'low_confidence',
    ]),
  })
  .strict();
export type Routing = z.infer<typeof RoutingSchema>;
