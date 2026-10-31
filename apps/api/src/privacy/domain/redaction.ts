export function redactIdentifiers(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, '[email removed]')
    .replace(/\b(?:\d[ -]?){13,19}\b/gu, '[number removed]')
    .replace(/(?<!\w)\+?\d[\d ().-]{8,}\d(?!\w)/gu, '[phone removed]')
    .replace(/<@[A-Z0-9]+>/gu, '[person]');
}
