type TemplateKeys<T extends string> = T extends `${string}{${infer Key}}${infer Rest}`
  ? Key | TemplateKeys<Rest>
  : never;
export function interpolate<T extends string>(
  template: T,
  values: Record<TemplateKeys<T>, string | number>,
): string {
  const entries: Record<string, string | number> = values;
  return template.replace(/\{([^}]+)\}/gu, (_, key: string) => String(entries[key] ?? ''));
}
