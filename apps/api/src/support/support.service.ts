import { PrivacyService } from '../privacy/privacy.service';
import { redactIdentifiers } from '../privacy/domain/redaction';
import { suggestedTags } from './helpers/summary';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import type { Repository } from 'typeorm';
import type { CreateCaseInput, SupportCase, SupportRun } from '@resolve/contracts';
import { CompanyService } from '../company/company.service';
import { ConnectionsService } from '../connections/connections.service';
import { CaseEntity } from '../database/entities/case.entity';
import { RunEntity } from '../database/entities/run.entity';
import { evaluatePolicy, allowedActions, rulesDecision } from './domain/policy';
import { MistralProvider } from './providers/mistral.provider';
import { JevProvider } from './providers/jev.provider';
import { StripeProvider } from '../billing/stripe.provider';
@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(CaseEntity) private readonly cases: Repository<CaseEntity>,
    @InjectRepository(RunEntity) private readonly runs: Repository<RunEntity>,
    private readonly company: CompanyService,
    private readonly connections: ConnectionsService,
    private readonly mistral: MistralProvider,
    private readonly jev: JevProvider,
    private readonly stripe: StripeProvider,
    private readonly privacy: PrivacyService,
  ) {}
  async create(input: CreateCaseInput): Promise<SupportCase> {
    const id = `custom_${randomUUID()}`;
    return this.cases.save(
      this.cases.create({
        ...input,
        id,
        customerId: `cus_${id}`,
        paymentId: `pi_${id}`,
        refundedCents: 0,
        currency: 'usd',
        provider: 'simulator',
        paymentStatus: 'paid',
        subscriptionStatus: 'active',
      }),
    );
  }
  async analyze(caseId: string, message: string): Promise<SupportRun> {
    const started = performance.now();
    const stored = await this.cases.findOneByOrFail({ id: caseId });
    const record = stored.provider === 'stripe' ? await this.stripe.readPayment(stored) : stored;
    const company = await this.company.get();
    const privacy = await this.privacy.get();
    const externalAllowed = privacy.aiEnabled && record.aiPreference !== 'human_only';
    const effectiveCompany = externalAllowed
      ? company
      : { ...company, decisionEngine: 'rules' as const };
    const modelMessage = privacy.redactBeforeAi ? redactIdentifiers(message) : message;
    const analysis = await this.mistral.analyze(modelMessage, record, effectiveCompany);
    const checks = evaluatePolicy(record, analysis.intent, company);
    const allowed = allowedActions(analysis.intent, checks);
    const decision =
      effectiveCompany.decisionEngine === 'jev'
        ? await this.jev.judge(modelMessage, record, company, allowed)
        : effectiveCompany.decisionEngine === 'auto' && this.connections.getMistralKey()
          ? await this.mistral.judge(modelMessage, record, company, allowed)
          : rulesDecision(record, analysis, company, allowed);
    const result: SupportRun = {
      privacyRevision: privacy.revision,
      id: randomUUID(),
      caseId,
      message,
      company,
      analysis,
      checks,
      decision,
      amountCents: record.amountCents - record.refundedCents,
      elapsedMs: Math.round(performance.now() - started),
      createdAt: new Date().toISOString(),
    };
    await this.runs.save({ id: result.id, caseId, result, createdAt: new Date(result.createdAt) });
    await this.cases.update(caseId, {
      summary: analysis.summary,
      triageStatus:
        decision.action === 'review' || decision.action === 'request_info' ? 'review' : 'ready',
      tags: [...new Set([...record.tags, ...suggestedTags(record, analysis.intent)])].slice(0, 8),
    });
    return result;
  }
}
