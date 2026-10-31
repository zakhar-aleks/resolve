import type { Routing, RoutingAnalysis, SupportCase, Analysis } from '@resolve/contracts';
import type { PolicySnapshot } from '../prompts/prompt-builder';
import { workflowIntent } from '../../workflows/domain/intent';
import { localSummary } from '../helpers/summary';
export function billingIntent(scenario: RoutingAnalysis['scenario']): Analysis['intent'] {
  return scenario === 'refund' ? 'refund' : scenario === 'cancel' ? 'cancel' : 'investigate';
}
export function localRoute(message: string, record: SupportCase): RoutingAnalysis {
  const scenario =
    workflowIntent(message) ??
    (/cancel/iu.test(message)
      ? 'cancel'
      : /refund|twice|duplicate/iu.test(message)
        ? 'refund'
        : 'investigate');
  return {
    scenario,
    complexity: 'low',
    summary: localSummary(record, billingIntent(scenario)),
    policyConflict: false,
    missingInformation: [],
  };
}
export function selectRoute(
  analysis: RoutingAnalysis,
  snapshot: PolicySnapshot,
  smallModel: string,
  largeModel: string,
  canUseMistral: boolean,
  standard: 'small' | 'jev',
  standardModel = smallModel,
): Routing {
  const common = { scenario: analysis.scenario, complexity: analysis.complexity };
  if (analysis.policyConflict)
    return { ...common, destination: 'human', model: null, reason: 'policy_conflict' };
  if (analysis.missingInformation.length > 0)
    return { ...common, destination: 'human', model: null, reason: 'missing_information' };
  if (analysis.complexity === 'high') {
    if (snapshot.company.routingMode !== 'adaptive')
      return { ...common, destination: 'human', model: null, reason: 'large_disabled' };
    if (!largeModel || !canUseMistral)
      return { ...common, destination: 'human', model: null, reason: 'large_unavailable' };
    return { ...common, destination: 'large', model: largeModel, reason: 'complex' };
  }
  return { ...common, destination: standard, model: standardModel, reason: 'standard' };
}
