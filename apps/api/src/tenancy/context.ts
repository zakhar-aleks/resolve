import { AsyncLocalStorage } from 'node:async_hooks';
import type { DataSource } from 'typeorm';
export interface WorkspaceContext {
  id: string;
  data: DataSource;
  secrets: Record<string, string>;
  role: 'owner' | 'agent' | 'reviewer';
  userId?: string;
  apiRole?: 'intake' | 'reviewer';
}
export const workspaceContext = new AsyncLocalStorage<WorkspaceContext>();
export function scopedDataSource(base: DataSource): DataSource {
  return new Proxy(base, {
    get(target, property) {
      if (property === CATALOGUE) return target;
      const source = workspaceContext.getStore()?.data ?? target;
      const value: unknown = Reflect.get(source, property);
      return typeof value === 'function' ? value.bind(source) : value;
    },
  });
}
export const CATALOGUE = Symbol('catalogue');
export function catalogueDataSource(data: DataSource): DataSource {
  return Reflect.get(data, CATALOGUE) as DataSource;
}
