export const CONFIRMED_STATUSES = ['confirmed', 'invoiced', 'shipped', 'delivered'] as const;

export interface DateRange {
  days: number;
  start: Date;
  prevStart: Date;
  prevEnd: Date;
}

export function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function buildRange(days: number, now: Date = new Date()): DateRange {
  const normalized = days === 7 || days === 90 ? days : 30;
  const start = startOfDay(now);
  start.setDate(start.getDate() - (normalized - 1));
  const prevEnd = new Date(start);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - normalized);
  return { days: normalized, start, prevStart, prevEnd };
}

export function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function toNumber(value: unknown): number {
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return toNumber((value as { toNumber(): unknown }).toNumber());
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
