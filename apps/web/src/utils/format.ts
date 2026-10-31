const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export function formatMoney(cents: number): string {
  return currency.format(cents / 100);
}
export function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Kyiv',
  }).format(new Date(value));
}
export function initials(name: string): string {
  return name
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}
export function formatCount(value: number): string {
  return String(value).padStart(2, '0');
}
export function formatInteger(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatAppointment(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(value));
}
