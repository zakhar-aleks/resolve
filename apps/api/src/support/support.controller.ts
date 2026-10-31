import { Body, Controller, Param, Post } from '@nestjs/common';
import { AnalyzeSchema, CreateCaseSchema, type CreateCaseInput } from '@resolve/contracts';
import { SchemaPipe } from '../common/pipes/schema.pipe';
import { SupportService } from './support.service';
@Controller('cases')
export class SupportController {
  constructor(private readonly support: SupportService) {}
  @Post() create(@Body(new SchemaPipe(CreateCaseSchema)) input: CreateCaseInput) {
    return this.support.create(input);
  }
  @Post(':id/analyze') analyze(
    @Param('id') id: string,
    @Body(new SchemaPipe(AnalyzeSchema)) input: { message: string },
  ) {
    return this.support.analyze(id, input.message);
  }
}
