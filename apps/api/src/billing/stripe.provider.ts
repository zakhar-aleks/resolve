import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { BillingOperation, Receipt, SupportCase } from '@resolve/contracts';
import { environment } from '../config/environment';
import { invalid } from '../common/errors';
import { requestJson } from '../common/http/json-client';
const paymentSchema = z.object({
  id: z.string(),
  livemode: z.boolean(),
  customer: z.string().nullable(),
  amount: z.number().int(),
  created: z.number(),
  currency: z.string(),
  status: z.string(),
  latest_charge: z.string().nullable(),
});
const refundSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'succeeded', 'failed', 'canceled', 'requires_action']),
  amount: z.number().int(),
  metadata: z.record(z.string(), z.string()).default({}),
});
@Injectable()
export class StripeProvider {
  private headers(): Record<string, string> {
    if (!/^(sk|rk)_test_/u.test(environment.STRIPE_SECRET_KEY)) invalid('STRIPE_TEST_KEY_REQUIRED');
    return { Authorization: `Bearer ${environment.STRIPE_SECRET_KEY}` };
  }
  async readPayment(record: SupportCase): Promise<SupportCase> {
    const payment = await requestJson(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(record.paymentId)}`,
      paymentSchema,
      { headers: this.headers() },
    );
    if (
      payment.livemode ||
      payment.customer !== record.customerId ||
      record.customerId !== environment.STRIPE_TEST_CUSTOMER_ID
    )
      invalid('PAYMENT_OWNERSHIP_FAILED');
    if (payment.currency !== 'usd') invalid('UNSUPPORTED_CURRENCY');
    const charge = payment.latest_charge
      ? await requestJson(
          `https://api.stripe.com/v1/charges/${encodeURIComponent(payment.latest_charge)}`,
          z.object({ amount_refunded: z.number().int() }),
          { headers: this.headers() },
        )
      : { amount_refunded: 0 };
    return {
      ...record,
      amountCents: payment.amount,
      ageDays: Math.floor((Date.now() / 1000 - payment.created) / 86400),
      refundedCents: charge.amount_refunded,
      paymentStatus: payment.status,
    };
  }
  private receipt(refund: z.infer<typeof refundSchema>): Receipt {
    return { id: refund.id, status: refund.status, provider: 'stripe', amountCents: refund.amount };
  }
  async refund(record: SupportCase, operation: BillingOperation): Promise<Receipt> {
    const headers = {
      ...this.headers(),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': operation.id,
    };
    const refund = await requestJson('https://api.stripe.com/v1/refunds', refundSchema, {
      method: 'POST',
      headers,
      body: new URLSearchParams({
        payment_intent: record.paymentId,
        amount: String(operation.amountCents),
        'metadata[resolve_operation_id]': operation.id,
      }),
    });
    return this.receipt(refund);
  }
  async findReceipt(record: SupportCase, operation: BillingOperation): Promise<Receipt | null> {
    if (operation.receipt)
      return this.receipt(
        await requestJson(
          `https://api.stripe.com/v1/refunds/${encodeURIComponent(operation.receipt.id)}`,
          refundSchema,
          { headers: this.headers() },
        ),
      );
    const result = await requestJson(
      `https://api.stripe.com/v1/refunds?${new URLSearchParams({ payment_intent: record.paymentId, limit: '100' })}`,
      z.object({ data: z.array(refundSchema) }),
      { headers: this.headers() },
    );
    const found = result.data.find(
      (refund) => refund.metadata['resolve_operation_id'] === operation.id,
    );
    return found ? this.receipt(found) : null;
  }
}
