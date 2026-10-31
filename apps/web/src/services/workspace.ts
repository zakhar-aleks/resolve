import type { AppState } from '@resolve/contracts';
import { COPY } from '../consts/copy';
import { VIEWS, type View } from '../consts/routes';
import type { WorkspaceModel, WorkspaceSelection } from '../types/workspace';
import { ApiError } from '../wrappers/api-client';
export function parseView(value: string | null): View {
  return VIEWS.find((view) => view === value) ?? 'support';
}
export function errorMessage(error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'VALIDATION_FAILED';
  return Object.hasOwn(COPY.errors, code)
    ? COPY.errors[code as keyof typeof COPY.errors]
    : COPY.errors.UNKNOWN;
}
export function workspaceModel(
  state: AppState,
  selection: WorkspaceSelection = {},
): WorkspaceModel {
  const record =
    state.cases.find((record) => record.id === (selection.caseId ?? 'duplicate')) ??
    state.cases[0] ??
    null;
  const run =
    state.runs.find(
      (run) => run.caseId === record?.id && (!selection.runId || run.id === selection.runId),
    ) ?? null;
  const operation =
    state.operations.find(
      (operation) =>
        operation.caseId === record?.id &&
        (!run ||
          operation.runId === run.id ||
          record?.status === 'resolved' ||
          ['dispatched', 'unknown', 'pending'].includes(operation.state)),
    ) ?? null;
  return {
    state,
    view: selection.view ?? 'support',
    record,
    run,
    operation,
    notice: selection.notice ?? null,
  };
}
