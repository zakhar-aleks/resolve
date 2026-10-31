import { ROUTES, type View } from '../consts/routes';
export function workspaceUrl(view: View, caseId?: string): string {
  const query = new URLSearchParams({ view });
  if (caseId) query.set('case', caseId);
  return `/?${query}`;
}
export function fragmentUrl(view: View, caseId?: string): string {
  return `${ROUTES.workspace}${workspaceUrl(view, caseId).slice(1)}`;
}
