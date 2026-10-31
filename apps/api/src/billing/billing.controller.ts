import { Controller, Param, Post } from '@nestjs/common';
import { IdSchema } from '@resolve/contracts';
import { SchemaPipe } from '../common/pipes/schema.pipe';
import { BillingService } from './billing.service';
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}
  @Post('runs/:id/execute') execute(@Param('id', new SchemaPipe(IdSchema)) id: string) {
    return this.billing.execute(id);
  }
  @Post('operations/:id/reconcile') reconcile(@Param('id', new SchemaPipe(IdSchema)) id: string) {
    return this.billing.reconcile(id);
  }
}
