import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { CaseUpdateInput, SupportCase, IntakeInput } from '@resolve/contracts';
import { CaseEntity } from '../database/entities/case.entity';
import { randomUUID } from 'node:crypto';
import { conflict } from '../common/errors';
@Injectable()
export class CaseManagementService {
  constructor(private readonly data: DataSource) {}
  async update(id: string, input: CaseUpdateInput): Promise<SupportCase> {
    return this.data.transaction(async (manager) => {
      const record = await manager.findOneOrFail(CaseEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (record.archivedAt) conflict('ARCHIVED_REQUEST');
      const preferenceChanged = record.aiPreference !== input.aiPreference;
      Object.assign(record, input, {
        tags: [...new Set(input.tags)],
        closedAt:
          input.status === 'resolved' ? (record.closedAt ?? new Date().toISOString()) : null,
      });
      if (preferenceChanged) record.triageStatus = 'pending';
      return manager.save(record);
    });
  }
  async intake(input: IntakeInput): Promise<{ reference: string }> {
    const id = `request_${randomUUID()}`;
    await this.data.getRepository(CaseEntity).save(
      this.data.getRepository(CaseEntity).create({
        ...input,
        id,
        amountCents: 0,
        ageDays: 0,
        reason: 'unknown',
        customerId: '',
        paymentId: id,
        refundedCents: 0,
        currency: 'usd',
        provider: 'unlinked',
        paymentStatus: 'unlinked',
        subscriptionStatus: 'active',
        triageStatus: 'pending',
      }),
    );
    return { reference: id };
  }
}
