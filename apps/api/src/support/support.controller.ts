import { Body, Controller, Param, Post, Patch } from '@nestjs/common';
import {
  AnalyzeSchema,
  CreateCaseSchema,
  CaseUpdateSchema,
  type CaseUpdateInput,
  type CreateCaseInput,
} from '@resolve/contracts';
import { SchemaPipe } from '../common/pipes/schema.pipe';
import { CaseManagementService } from './case-management.service';
import { SupportService } from './support.service';
@Controller('cases')
export class SupportController {
  constructor(
    private readonly support: SupportService,
    private readonly management: CaseManagementService,
  ) {}
  @Post() create(@Body(new SchemaPipe(CreateCaseSchema)) input: CreateCaseInput) {
    return this.support.create(input);
  }
  @Post(':id/analyze') analyze(
    @Param('id') id: string,
    @Body(new SchemaPipe(AnalyzeSchema)) input: { message: string },
  ) {
    return this.support.analyze(id, input.message);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body(new SchemaPipe(CaseUpdateSchema)) input: CaseUpdateInput,
  ) {
    return this.management.update(id, input);
  }
}
