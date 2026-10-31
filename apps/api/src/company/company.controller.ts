import { PolicyContextService } from '../support/prompts/policy-context.service';
import { Body, Controller, Get, Put } from '@nestjs/common';
import { CompanyInputSchema, type CompanyProfile } from '@resolve/contracts';
import { SchemaPipe } from '../common/pipes/schema.pipe';
import { CompanyService } from './company.service';
@Controller('company')
export class CompanyController {
  constructor(
    private readonly companies: CompanyService,
    private readonly policies: PolicyContextService,
  ) {}
  @Get('prompt') async prompt() {
    return this.policies.preview(await this.policies.load());
  }
  @Get() get(): Promise<CompanyProfile> {
    return this.companies.get();
  }
  @Put() update(
    @Body(new SchemaPipe(CompanyInputSchema)) input: CompanyProfile,
  ): Promise<CompanyProfile> {
    return this.companies.update(input);
  }
}
