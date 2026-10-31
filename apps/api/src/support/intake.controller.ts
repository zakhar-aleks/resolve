import { Body, Controller, Post } from '@nestjs/common';
import { IntakeSchema, type IntakeInput } from '@resolve/contracts';
import { SchemaPipe } from '../common/pipes/schema.pipe';
import { CaseManagementService } from './case-management.service';
@Controller('intake')
export class IntakeController {
  constructor(private readonly cases: CaseManagementService) {}
  @Post() create(@Body(new SchemaPipe(IntakeSchema)) input: IntakeInput) {
    return this.cases.intake(input);
  }
}
