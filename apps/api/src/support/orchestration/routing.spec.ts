import { it, expect } from 'vitest';
import {
  DEFAULT_COMPANY,
  DEFAULT_PRIVACY,
  DEFAULT_WORKFLOW_POLICY,
  type RoutingAnalysis,
} from '@resolve/contracts';
import { buildSnapshot } from '../prompts/prompt-builder';
import { selectRoute } from './routing';
const analysis: RoutingAnalysis = {
  scenario: 'refund',
  complexity: 'low',
  summary: 'Duplicate charge',
  policyConflict: false,
  missingInformation: [],
};
const snapshot = buildSnapshot(DEFAULT_COMPANY, DEFAULT_PRIVACY, DEFAULT_WORKFLOW_POLICY);
it('uses the small model for standard work', () => {
  expect(selectRoute(analysis, snapshot, 'small', 'large', true, 'small').destination).toBe(
    'small',
  );
});
it('never spends on a large model without company permission and configuration', () => {
  expect(
    selectRoute({ ...analysis, complexity: 'high' }, snapshot, 'small', 'large', true, 'small')
      .reason,
  ).toBe('large_disabled');
  const adaptive = buildSnapshot(
    { ...DEFAULT_COMPANY, routingMode: 'adaptive' },
    DEFAULT_PRIVACY,
    DEFAULT_WORKFLOW_POLICY,
  );
  expect(
    selectRoute({ ...analysis, complexity: 'high' }, adaptive, 'small', '', true, 'small').reason,
  ).toBe('large_unavailable');
  expect(
    selectRoute({ ...analysis, complexity: 'high' }, adaptive, 'small', 'large', true, 'small'),
  ).toMatchObject({ destination: 'large', model: 'large' });
});
it('routes missing evidence and policy conflicts to people regardless of model budget', () => {
  expect(
    selectRoute({ ...analysis, policyConflict: true }, snapshot, 'small', 'large', true, 'small')
      .destination,
  ).toBe('human');
  expect(
    selectRoute(
      { ...analysis, missingInformation: ['Order ownership'] },
      snapshot,
      'small',
      'large',
      true,
      'small',
    ).reason,
  ).toBe('missing_information');
});
