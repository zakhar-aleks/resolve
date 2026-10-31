import { COPY } from '../consts/copy';
import { companyForm, caseForm, connectionForm, idForm, text } from '../helpers/forms';
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
