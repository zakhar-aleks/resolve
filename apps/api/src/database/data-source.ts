import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { environment } from '../config/environment';
import { CompanyEntity } from './entities/company.entity';
import { CaseEntity } from './entities/case.entity';
import { RunEntity } from './entities/run.entity';
import { OperationEntity, EventEntity } from './entities/operation.entity';
import { Initial1793440800000 } from './migrations/initial';
export const databaseOptions = {
  type: 'postgres' as const,
  url: environment.DATABASE_URL,
  entities: [CompanyEntity, CaseEntity, RunEntity, OperationEntity, EventEntity],
  migrations: [Initial1793440800000],
  migrationsRun: true,
  synchronize: false,
  retryAttempts: 1,
  logging: false,
};
export default new DataSource(databaseOptions);
