import { Injectable } from '@nestjs/common';
import type { Analysis, Decision, Routing, SupportCase } from '@resolve/contracts';
import { environment } from '../../config/environment';
import { ConnectionsService } from '../../connections/connections.service';
import { MistralProvider } from '../providers/mistral.provider';
import { JevProvider } from '../providers/jev.provider';
import type { PolicySnapshot } from '../prompts/prompt-builder';
import { redactIdentifiers } from '../../privacy/domain/redaction';
import { evaluatePolicy, allowedActions, rulesDecision } from '../domain/policy';
import { billingIntent, localRoute, selectRoute } from './routing';
@Injectable()
export class SupportOrchestrator {
  constructor(
    private readonly connections: ConnectionsService,
    private readonly mistral: MistralProvider,
    private readonly jev: JevProvider,
  ) {}
  async prepare(message: string, record: SupportCase, snapshot: PolicySnapshot) {
    const { company, privacy } = snapshot;
    const humanOnly = record.aiPreference === 'human_only';
    const externalAllowed = privacy.aiEnabled && !humanOnly && company.decisionEngine !== 'rules';
    const standard = company.decisionEngine === 'jev' ? 'jev' : 'small';
    const available =
      standard === 'jev'
        ? Boolean(this.connections.getJevKey())
        : Boolean(this.connections.getMistralKey());
    const modelMessage = privacy.redactBeforeAi ? redactIdentifiers(message) : message;
    const external = externalAllowed && available;
    const routed = external
      ? standard === 'jev'
        ? await this.jev.route(modelMessage, record, snapshot)
        : await this.mistral.route(modelMessage, record, snapshot)
      : localRoute(message, record);
    const analysis: Analysis = {
      intent: billingIntent(routed.scenario),
      summary: routed.summary,
      source: external
        ? standard === 'jev'
          ? environment.JEV_MODEL
          : environment.MISTRAL_MODEL
        : 'rules',
    };
    const checks = evaluatePolicy(record, analysis.intent, company);
    const allowed = allowedActions(analysis.intent, checks);
    const routing: Routing = external
      ? selectRoute(
          routed,
          snapshot,
          environment.MISTRAL_MODEL,
          environment.MISTRAL_LARGE_MODEL,
          Boolean(this.connections.getMistralKey()),
          standard,
          standard === 'jev' ? environment.JEV_MODEL : environment.MISTRAL_MODEL,
        )
      : {
          scenario: routed.scenario,
          complexity: routed.complexity,
          destination: 'local',
          model: null,
          reason: humanOnly
            ? 'human_only'
            : !privacy.aiEnabled
              ? 'ai_disabled'
              : company.decisionEngine === 'rules'
                ? 'rules_only'
                : 'provider_unavailable',
        };
    if (externalAllowed && !available && standard === 'jev') {
      routing.destination = 'human';
      routing.reason = 'provider_unavailable';
    }
    let decision: Decision;
    if (routing.destination === 'local')
      decision = rulesDecision(record, analysis, company, allowed);
    else if (routing.destination === 'human')
      decision = {
        action: routing.reason === 'missing_information' ? 'request_info' : 'review',
        risk: null,
        fulfillment: null,
        confidence: null,
        rationale:
          'A support specialist needs to review this request before an action is prepared.',
        reply: '',
        source: 'orchestrator',
      };
    else if (routing.destination === 'jev')
      decision = await this.jev.judge(modelMessage, record, snapshot, allowed);
    else
      decision = await this.mistral.judge(
        modelMessage,
        record,
        snapshot,
        allowed,
        routing.model ?? environment.MISTRAL_MODEL,
      );
    return { analysis, checks, decision, routing };
  }
}
