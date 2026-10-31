import { In, IsNull } from 'typeorm';
import { CaseEntity } from '../database/entities/case.entity';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { CompanySchema, type CompanyProfile } from '@resolve/contracts';
import { CompanyEntity } from '../database/entities/company.entity';
import { conflict } from '../common/errors';
@Injectable()
export class CompanyService {
  constructor(private readonly data: DataSource) {}
  private get companies() {
    return this.data.getRepository(CompanyEntity);
  }
  async get(): Promise<CompanyProfile> {
    return CompanySchema.parse((await this.companies.findOneByOrFail({ id: 1 })).profile);
  }
  async update(input: CompanyProfile): Promise<CompanyProfile> {
    return this.companies.manager.transaction(async (manager) => {
      const repo = manager.getRepository(CompanyEntity);
      const company = await repo.findOneOrFail({
        where: { id: 1 },
        lock: { mode: 'pessimistic_write' },
      });
      if (company.profile.revision !== input.revision) conflict('STALE_SETTINGS');
      company.profile = { ...input, revision: randomUUID() };
      await repo.save(company);
      await manager.update(
        CaseEntity,
        { status: In(['open', 'waiting']), archivedAt: IsNull() },
        { triageStatus: 'pending' },
      );
      return company.profile;
    });
  }
}
