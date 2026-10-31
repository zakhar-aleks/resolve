import type { AppState, BillingOperation, SupportCase, SupportRun } from '@resolve/contracts';
import type { View } from '../consts/routes';
export interface Notice {
  kind: 'success' | 'error';
  message: string;
}
export interface WorkspaceModel {
  state: AppState;
  view: View;
  record: SupportCase | null;
  run: SupportRun | null;
  operation: BillingOperation | null;
  notice: Notice | null;
}
export interface WorkspaceSelection {
  view?: View;
  caseId?: string;
  runId?: string;
  notice?: Notice;
}
