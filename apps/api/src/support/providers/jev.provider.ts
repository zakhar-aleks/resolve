import { PolicyContextService } from '../prompts/policy-context.service';
import { taskPrompt, type PolicySnapshot } from '../prompts/prompt-builder';
import { localSummary } from '../helpers/summary';
import { billingIntent } from '../orchestration/routing';
import { modelBillingContext } from '../helpers/summary';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ScenarioSchema } from '@resolve/contracts';
import type { Decision, SupportCase, RoutingAnalysis } from '@resolve/contracts';
import { ConnectionsService } from '../../connections/connections.service';
import { environment } from '../../config/environment';
import { invalid } from '../../common/errors';
import { requestJson } from '../../common/http/json-client';
@Injectable()
export class JevProvider {
  constructor(
    private readonly connections: ConnectionsService,
    private readonly policies: PolicyContextService,
  ) {}
  async route(
    message: string,
    record: SupportCase,
    snapshot: PolicySnapshot,
  ): Promise<RoutingAnalysis> {
    await this.policies.assertExternalAllowed(snapshot, record);
    const key = this.connections.getJevKey();
    if (!key) invalid('JEV_KEY_REQUIRED');
    const choice = z.object({ choice: z.string(), confidence: z.number().min(0).max(1) });
    const result = await requestJson(
      'https://api.typesafe.ai/v1/systemone',
      z.object({
        answers: z.object({
          scenario: choice,
          complexity: choice,
          policyConflict: choice,
          missingInformation: choice,
        }),
      }),
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: environment.JEV_MODEL,
          state: { customerMessage: message, billingFacts: modelBillingContext(record) },
          questions: {
            scenario: {
              type: 'choice',
              instructions: taskPrompt(snapshot, 'jev_route'),
              criteria: Object.fromEntries(
                [
                  'refund',
                  'cancel',
                  'change_address',
                  'arrange_return',
                  'reschedule_appointment',
                  'recover_account',
                  'update_preferences',
                  'privacy_request',
                  'investigate',
                ].map((kind) => [kind, kind]),
              ),
            },
            complexity: {
              type: 'choice',
              instructions:
                'Estimate complexity. Conflicting evidence, exceptions, ambiguous policy or multiple interdependent changes require high complexity.',
              criteria: { low: 'Straightforward request', high: 'Complex or uncertain request' },
            },
            policyConflict: {
              type: 'choice',
              instructions:
                'Does this request require a policy exception or involve conflicting policy?',
              criteria: { yes: 'Conflict or exception', no: 'No conflict' },
            },
            missingInformation: {
              type: 'choice',
              instructions: 'Is essential information missing for choosing the next workflow?',
              criteria: {
                yes: 'Essential information is absent',
                no: 'Sufficient information to identify workflow',
              },
            },
          },
        }),
      },
    );
    const scenario = ScenarioSchema.parse(result.answers.scenario.choice);
    const complexity = z.enum(['low', 'high']).parse(result.answers.complexity.choice);
    const conflict = z.enum(['yes', 'no']).parse(result.answers.policyConflict.choice);
    const missing = z.enum(['yes', 'no']).parse(result.answers.missingInformation.choice);
    const uncertain = Object.values(result.answers).some(
      (answer) => answer.confidence < snapshot.company.jevConfidenceThreshold,
    );
    return {
      scenario,
      complexity,
      summary: localSummary(record, billingIntent(scenario)),
      policyConflict: conflict === 'yes' || uncertain,
      missingInformation: missing === 'yes' ? ['Ask the customer for the missing details.'] : [],
    };
  }
  async judge(
    message: string,
    record: SupportCase,
    snapshot: PolicySnapshot,
    allowed: readonly string[],
  ): Promise<Decision> {
    const company = snapshot.company;
    await this.policies.assertExternalAllowed(snapshot, record);
    const key = this.connections.getJevKey();
    if (!key) invalid('JEV_KEY_REQUIRED');
    const schema = z.object({
      answers: z.object({
        resolution: z.object({
          choice: z.enum(['refund', 'cancel', 'review', 'request_info']),
          confidence: z.number().min(0).max(1),
        }),
        risk: z.object({ score: z.number().min(0).max(2) }),
        fulfillment: z.object({ score: z.number().min(0).max(2) }),
      }),
    });
    const result = await requestJson('https://api.typesafe.ai/v1/systemone', schema, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: environment.JEV_MODEL,
        state: { customerMessage: message, billingFacts: modelBillingContext(record) },
        questions: {
          resolution: {
            type: 'choice',
            instructions: taskPrompt(snapshot, 'jev'),
            criteria: Object.fromEntries(allowed.map((action) => [action, action])),
          },
          risk: {
            type: 'score',
            instructions: 'Evidence mismatch severity; identity and tone are not risk signals.',
            criteria: [
              'Evidence supports request',
              'Evidence incomplete',
              'Evidence contradicts request',
            ],
          },
          fulfillment: {
            type: 'score',
            instructions: 'How fully does the requested resolution address the stated goal?',
            criteria: ['Does not address goal', 'Partially addresses goal', 'Fully addresses goal'],
          },
        },
      }),
    });
    const { resolution, risk, fulfillment } = result.answers;
    if (!allowed.includes(resolution.choice)) invalid('INVALID_MODEL_RESPONSE');
    return {
      action:
        resolution.confidence < company.jevConfidenceThreshold || risk.score > 1
          ? 'review'
          : resolution.choice,
      confidence: resolution.confidence,
      risk: risk.score,
      fulfillment: fulfillment.score,
      rationale: '',
      reply: '',
      source: environment.JEV_MODEL,
    };
  }
}
