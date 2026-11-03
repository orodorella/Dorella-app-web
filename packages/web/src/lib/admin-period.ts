import { formatDateRange, formatMonth } from '@/lib/format';

/**
 * Periodo compartido de las pantallas de análisis del panel (?periodo=…&desde=…&hasta=…).
 * Fechas en hora de Colombia, formato YYYY-MM-DD, ambos extremos inclusive (igual que el API).
 */
export type PeriodPreset = 'hoy' | '7d' | '30d' | '90d' | 'mes' | 'mes-pasado' | 'custom';

/** "30 días" es el único periodo que aceptan todos los endpoints (el Dashboard solo admite 7, 30 o 90 días). */
export const DEFAULT_PRESET: PeriodPreset = '30d';
export const STANDARD_PRESETS: PeriodPreset[] = ['hoy', '7d', '30d', 'mes', 'mes-pasado', 'custom'];
/** El API del Dashboard solo acepta days=7|30|90 (sin fechas). */
export const DASHBOARD_PRESETS: PeriodPreset[] = ['7d', '30d', '90d'];

export const PRESET_LABELS: Record<PeriodPreset, string> = {
  hoy: 'Hoy', '7d': '7 días', '30d': '30 días', '90d': '90 días', mes: 'Este mes', 'mes-pasado': 'Mes pasado', custom: 'Personalizado',
};

const PRESET_DAYS: Partial<Record<PeriodPreset, number>> = { hoy: 1, '7d': 7, '30d': 30, '90d': 90 };
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export interface Comparison {
  from: string;
  to: string;
  /** Texto corto para el KPI, p. ej. "vs. mismo tramo del mes anterior". */
  label: string;
  /** Rango legible, p. ej. "1–3 oct 2026". */
  rangeLabel: string;
  /** true si coincide con el periodo anterior que ya calcula el API (misma duración, inmediatamente antes). */
  matchesApi: boolean;
}

export interface ResolvedPeriod {
  preset: PeriodPreset;
  from: string;
  to: string;
  days: number;
  label: string;
  rangeLabel: string;
  /** El periodo aún no termina (mes en curso): no se compara contra un periodo completo. */
  partial: boolean;
  comparison: Comparison;
}

const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const parseDay = (day: string) => Date.parse(`${day}T00:00:00Z`);
const addDays = (day: string, delta: number) => toDay(parseDay(day) + delta * DAY_MS);
const monthStart = (day: string) => `${day.slice(0, 8)}01`;
function addMonths(day: string, delta: number): string {
  const d = new Date(parseDay(monthStart(day)));
  d.setUTCMonth(d.getUTCMonth() + delta);
  return toDay(d.getTime());
}
const monthEnd = (day: string) => addDays(addMonths(day, 1), -1);
const isValidDay = (day: string | null | undefined): day is string => !!day && DAY_RE.test(day) && !Number.isNaN(parseDay(day)) && toDay(parseDay(day)) === day;

/** Hoy en Colombia (UTC-5 fijo). */
export function todayBogota(now: Date = new Date()): string {
  return toDay(now.getTime() - 5 * 3_600_000);
}

/** Mismo cálculo que `previousPeriod` del API: misma duración, inmediatamente antes. */
export function apiPreviousPeriod(from: string, to: string): { from: string; to: string } {
  const days = Math.round((parseDay(to) - parseDay(from)) / DAY_MS) + 1;
  return { from: addDays(from, -days), to: addDays(from, -1) };
}

function comparisonFor(preset: PeriodPreset, from: string, to: string, partial: boolean): Omit<Comparison, 'matchesApi' | 'rangeLabel'> {
  if (preset === 'mes') {
    const prevStart = addMonths(from, -1);
    const elapsed = Math.round((parseDay(to) - parseDay(from)) / DAY_MS);
    const prevTo = [addDays(prevStart, elapsed), monthEnd(prevStart)].sort()[0];
    return partial
      ? { from: prevStart, to: prevTo, label: 'vs. mismo tramo del mes anterior' }
      : { from: prevStart, to: monthEnd(prevStart), label: `vs. ${formatMonth(prevStart)}` };
  }
  if (preset === 'mes-pasado') {
    const prevStart = addMonths(from, -1);
    return { from: prevStart, to: monthEnd(prevStart), label: `vs. ${formatMonth(prevStart)}` };
  }
  const prev = apiPreviousPeriod(from, to);
  if (preset === 'hoy') return { ...prev, label: 'vs. ayer' };
  const days = PRESET_DAYS[preset];
  return { ...prev, label: days ? `vs. los ${days} días anteriores` : 'vs. periodo anterior' };
}

export function resolvePeriod(
  preset: PeriodPreset,
  custom: { from?: string | null; to?: string | null } = {},
  now: Date = new Date(),
): ResolvedPeriod {
  const today = todayBogota(now);
  let from: string;
  let to = today;
  let partial = false;

  if (preset === 'custom' && isValidDay(custom.from) && isValidDay(custom.to) && custom.from <= custom.to) {
    from = custom.from;
    to = custom.to;
  } else if (preset === 'mes') {
    from = monthStart(today);
    partial = today !== monthEnd(today);
  } else if (preset === 'mes-pasado') {
    from = addMonths(today, -1);
    to = monthEnd(from);
  } else {
    if (preset === 'custom' || !PRESET_DAYS[preset]) preset = DEFAULT_PRESET;
    from = addDays(today, -((PRESET_DAYS[preset] ?? 30) - 1));
  }

  const base = comparisonFor(preset, from, to, partial);
  const api = apiPreviousPeriod(from, to);
  return {
    preset,
    from,
    to,
    days: Math.round((parseDay(to) - parseDay(from)) / DAY_MS) + 1,
    label: preset === 'custom' ? formatDateRange(from, to) : PRESET_LABELS[preset],
    rangeLabel: formatDateRange(from, to),
    partial,
    comparison: { ...base, rangeLabel: formatDateRange(base.from, base.to), matchesApi: base.from === api.from && base.to === api.to },
  };
}

/** Lee el periodo de la URL; si no es válido o la pantalla no lo admite, usa el predeterminado. */
export function periodFromParams(
  params: Pick<URLSearchParams, 'get'>,
  allowed: PeriodPreset[] = STANDARD_PRESETS,
  now: Date = new Date(),
): ResolvedPeriod {
  const raw = params.get('periodo') as PeriodPreset | null;
  const preset = raw && allowed.includes(raw) ? raw : allowed.includes(DEFAULT_PRESET) ? DEFAULT_PRESET : allowed[0];
  return resolvePeriod(preset, { from: params.get('desde'), to: params.get('hasta') }, now);
}

/** Escribe el periodo en los parámetros (conserva los demás filtros de la pantalla). */
export function periodToParams(current: URLSearchParams, preset: PeriodPreset, custom?: { from: string; to: string }): URLSearchParams {
  const next = new URLSearchParams(current);
  if (preset === DEFAULT_PRESET) next.delete('periodo');
  else next.set('periodo', preset);
  if (preset === 'custom' && custom) {
    next.set('desde', custom.from);
    next.set('hasta', custom.to);
  } else {
    next.delete('desde');
    next.delete('hasta');
  }
  return next;
}
