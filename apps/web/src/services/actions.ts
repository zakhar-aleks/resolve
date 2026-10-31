import { apiRequest } from '../wrappers/api-client';
import { z } from 'zod';
import { workflowForm, workflowPolicyForm } from '../helpers/workflow-forms';
import { DEMO_WORKFLOW } from '../consts/workflows';
import { COPY } from '../consts/copy';
import {
  companyForm,
  caseForm,
  connectionForm,
  idForm,
  text,
  privacyForm,
  caseManagementForm,
} from '../helpers/forms';
import { supportApi } from './support-api';
import { workspaceModel, errorMessage, parseView } from './workspace';
import type { WorkspaceModel, WorkspaceSelection } from '../types/workspace';
export async function handleAction(action: string, form: FormData): Promise<WorkspaceModel> {
  const initial = await supportApi.state();
  const selected = text(form, 'caseId');
  const selection: WorkspaceSelection = {
    view: parseView(text(form, 'view')),
    ...(selected ? { caseId: selected } : {}),
  };
  try {
    switch (action) {
      case 'prepare-workflow':
        await supportApi.prepareWorkflow(workflowForm(form));
        selection.view = 'workflows';
        selection.notice = { kind: 'success', message: COPY.workflows.requestSaved };
        break;
      case 'confirm-workflow':
        await supportApi.confirmWorkflow(
          text(form, 'workflowId'),
          text(form, 'planHash'),
          DEMO_WORKFLOW.verificationToken,
        );
        selection.view = 'workflows';
        break;
      case 'execute-workflow':
        await supportApi.executeWorkflow(text(form, 'workflowId'), text(form, 'planHash'));
        selection.view = 'workflows';
        break;
      case 'reconcile-workflow':
        await supportApi.reconcileWorkflow(text(form, 'workflowId'));
        selection.view = 'workflows';
        break;
      case 'workflow-policy':
        await supportApi.saveWorkflowPolicy(workflowPolicyForm(form));
        selection.view = 'workflows';
        selection.notice = { kind: 'success', message: COPY.workflows.policySaved };
        break;
      case 'privacy':
        await supportApi.savePrivacy(privacyForm(form));
        selection.view = 'privacy';
        selection.notice = { kind: 'success', message: COPY.privacy.saved };
        break;
      case 'manage':
        await supportApi.updateCase(selected, caseManagementForm(form));
        break;
      case 'company':
        await supportApi.saveCompany(companyForm(form));
        selection.view = 'company';
        selection.notice = { kind: 'success', message: COPY.notices.companySaved };
        break;
      case 'create': {
        const record = await supportApi.createCase(caseForm(form));
        selection.caseId = record.id;
        selection.view = 'support';
        selection.notice = { kind: 'success', message: COPY.notices.caseCreated };
        break;
      }
      case 'analyze': {
        const run = await supportApi.analyze(selected, text(form, 'message'));
        selection.runId = run.id;
        break;
      }
      case 'execute': {
        const op = await supportApi.execute(idForm(form, 'runId'));
        selection.runId = op.runId;
        break;
      }
      case 'reconcile': {
        const op = await supportApi.reconcile(idForm(form, 'operationId'));
        selection.runId = op.runId;
        break;
      }
      case 'connect-slack':
        await apiRequest('/connections/slack', z.object({ ok: z.boolean() }), 'POST', {
          appToken: text(form, 'appToken'),
          teamId: text(form, 'teamId'),
          channelIds: text(form, 'channelIds').replaceAll(' ', ''),
          botToken: text(form, 'botToken'),
        });
        selection.view = 'connections';
        break;
      case 'connect':
        await supportApi.connect(connectionForm(form));
        selection.view = 'connections';
        selection.notice = { kind: 'success', message: COPY.notices.keySaved };
        break;
      case 'test-mistral': {
        const result = await supportApi.testMistral();
        selection.view = 'connections';
        selection.notice = {
          kind: 'success',
          message: result.modelAvailable ? COPY.notices.keyAccepted : COPY.notices.modelUnavailable,
        };
        break;
      }
      default:
        throw new Error('UNKNOWN_ACTION');
    }
    return workspaceModel(await supportApi.state(), selection);
  } catch (error) {
    selection.notice = { kind: 'error', message: errorMessage(error) };
    return workspaceModel(initial, selection);
  }
}
