import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  ConnectorPreparationSchema,
  ConnectorOutcomeSchema,
  type WorkflowCreate,
  type WorkflowPolicy,
} from '@resolve/contracts';
import { environment } from '../../config/environment';
import { invalid } from '../../common/errors';
@Injectable()
export class ConnectorProvider {
  configured(): boolean {
    return Boolean(environment.SERVICE_CONNECTOR_URL && environment.SERVICE_CONNECTOR_TOKEN);
  }
  private async request<T>(path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
    if (!this.configured()) invalid('SERVICE_NOT_CONNECTED');
    const response = await fetch(
      `${environment.SERVICE_CONNECTOR_URL.replace(/\/$/u, '')}${path}`,
      {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Authorization: `Bearer ${environment.SERVICE_CONNECTOR_TOKEN}`,
          'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) invalid('SERVICE_REQUEST_FAILED');
    const value: unknown = await response.json();
    return schema.parse(value);
  }
  prepare(id: string, input: WorkflowCreate, policy: WorkflowPolicy) {
    return this.request('/prepare', ConnectorPreparationSchema, {
      operationId: id,
      ...input,
      policy,
    });
  }
  confirm(planRef: string, verificationToken: string) {
    return this.request('/confirm', z.object({ confirmed: z.boolean() }).strict(), {
      planRef,
      verificationToken,
    });
  }
  execute(id: string, planRef: string, planHash: string) {
    return this.request('/execute', ConnectorOutcomeSchema, {
      operationId: id,
      idempotencyKey: id,
      planRef,
      planHash,
    });
  }
  outcome(id: string) {
    return this.request(`/operations/${encodeURIComponent(id)}`, ConnectorOutcomeSchema);
  }
}
