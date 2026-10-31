import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { PrivacyProfileSchema, PublicPrivacySchema, type PrivacyProfile } from '@resolve/contracts';
import { SchemaPipe } from '../common/pipes/schema.pipe';
import { CompanyService } from '../company/company.service';
import { PrivacyService } from './privacy.service';
@Controller('privacy')
export class PrivacyController {
  constructor(
    private readonly privacy: PrivacyService,
    private readonly company: CompanyService,
  ) {}
  @Get('notice') async notice() {
    return {
      companyName: (await this.company.get()).companyName,
      profile: PublicPrivacySchema.parse(await this.privacy.get()),
    };
  }
  @Get() get() {
    return this.privacy.get();
  }
  @Put() update(@Body(new SchemaPipe(PrivacyProfileSchema)) input: PrivacyProfile) {
    return this.privacy.update(input);
  }
  @Post('retention') retention() {
    return this.privacy.applyRetention();
  }
}
