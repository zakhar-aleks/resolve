import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DEFAULT_COMPANY, DEFAULT_PRIVACY } from '@resolve/contracts';
import { PrivacyEntity } from './entities/privacy.entity';
import { CompanyEntity } from './entities/company.entity';
import { CaseEntity } from './entities/case.entity';
import { SEED_CASES } from './seeds';
import { environment } from '../config/environment';
import { StripeProvider } from '../billing/stripe.provider';
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  constructor(
    private readonly data: DataSource,
    private readonly stripe: StripeProvider,
  ) {}
  async onApplicationBootstrap(): Promise<void> {
    await this.data
      .createQueryBuilder()
      .insert()
      .into(CompanyEntity)
      .values({ id: 1, profile: DEFAULT_COMPANY })
      .orIgnore()
      .execute();
    await this.data
      .createQueryBuilder()
      .insert()
      .into(PrivacyEntity)
      .values({ id: 1, profile: DEFAULT_PRIVACY })
      .orIgnore()
      .execute();
    for (const input of SEED_CASES) {
      await this.data
        .createQueryBuilder()
        .insert()
        .into(CaseEntity)
        .values({
          ...input,
          customerId: `cus_${input.id}`,
          paymentId: `pi_${input.id}`,
          refundedCents: 0,
          currency: 'usd',
          provider: 'simulator',
          paymentStatus: 'paid',
          subscriptionStatus: 'active',
        })
        .orIgnore()
        .execute();
    }
    if (environment.STRIPE_TEST_CUSTOMER_ID && environment.STRIPE_TEST_PAYMENT_INTENT_ID) {
      const record = await this.stripe.readPayment(
        this.data.getRepository(CaseEntity).create({
          id: 'stripe',
          name: 'Stripe test customer',
          title: 'Connected Stripe test payment',
          message: 'Please refund this test payment.',
          amountCents: 1,
          ageDays: 0,
          reason: 'requested',
          customerId: environment.STRIPE_TEST_CUSTOMER_ID,
          paymentId: environment.STRIPE_TEST_PAYMENT_INTENT_ID,
          refundedCents: 0,
          currency: 'usd',
          provider: 'stripe',
          paymentStatus: 'unknown',
          subscriptionStatus: 'active',
        }),
      );
      await this.data
        .createQueryBuilder()
        .insert()
        .into(CaseEntity)
        .values(record)
        .orIgnore()
        .execute();
    }
  }
}
