import { z } from 'zod';
import {
  WorkflowCreateSchema,
  WorkflowSchema,
  WorkflowPolicySchema,
  WorkflowConfirmationSchema,
  WorkflowExecutionSchema,
  AgentMessageSchema,
} from '@resolve/contracts';
export function agentApiSchema() {
  const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
  const operation = (summary: string, input?: string, reviewer = false) => ({
    summary,
    security: [{ [reviewer ? 'ReviewerKey' : 'AgentKey']: [] }],
    ...(input
      ? { requestBody: { required: true, content: { 'application/json': { schema: ref(input) } } } }
      : {}),
    responses: {
      '200': { description: 'Successful read' },
      '201': { description: 'Prepared or updated request' },
      '400': { description: 'Validation or ownership failure' },
      '401': { description: 'Invalid credential or insufficient scope' },
      '409': { description: 'Policy, resource or approval conflict' },
      '503': { description: 'API keys not configured' },
    },
  });
  return {
    openapi: '3.1.0',
    info: {
      title: 'Resolve Agent API',
      version: '1.0.0',
      description:
        'A single-workspace agent API. Connector actions require service-side ownership verification, reviewed privacy setup, and a reviewer credential. Demo operations change fictional records only.',
    },
    servers: [{ url: '/api/v1/agent' }],
    paths: {
      '/prompt': {
        get: operation('Inspect current system instructions and policy versions', undefined, true),
      },
      '/capabilities': { get: operation('List supported actions') },
      '/schema': { get: operation('Read this API schema') },
      '/messages': {
        post: operation('Accept a support message for automatic preparation', 'AgentMessage'),
      },
      '/policy': {
        get: operation('Read action permissions'),
        put: operation('Update action permissions', 'WorkflowPolicy', true),
      },
      '/requests': {
        get: operation('List recent workflows'),
        post: operation('Prepare a verified action', 'WorkflowCreate'),
      },
      '/requests/{id}': {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        get: operation('Read a workflow'),
      },
      ...Object.fromEntries(
        ['confirm', 'execute', 'reconcile'].map((action) => [
          `/requests/{id}/${action}`,
          {
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' },
              },
            ],
            post: operation(
              action,
              action === 'confirm'
                ? 'WorkflowConfirmation'
                : action === 'execute'
                  ? 'WorkflowExecution'
                  : undefined,
              action !== 'confirm',
            ),
          },
        ]),
      ),
    },
    components: {
      securitySchemes: {
        AgentKey: {
          type: 'http',
          scheme: 'bearer',
          description: 'RESOLVE_API_KEY: intake, preparation and reads',
        },
        ReviewerKey: {
          type: 'http',
          scheme: 'bearer',
          description: 'RESOLVE_REVIEWER_KEY: includes execution and policy changes',
        },
      },
      schemas: {
        WorkflowCreate: z.toJSONSchema(WorkflowCreateSchema),
        Workflow: z.toJSONSchema(WorkflowSchema),
        WorkflowPolicy: z.toJSONSchema(WorkflowPolicySchema),
        WorkflowConfirmation: z.toJSONSchema(WorkflowConfirmationSchema),
        WorkflowExecution: z.toJSONSchema(WorkflowExecutionSchema),
        AgentMessage: z.toJSONSchema(AgentMessageSchema),
      },
    },
  };
}
