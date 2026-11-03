/**
 * Formato único es-CO para cifras y fechas. Ensambla las partes a mano donde la
 * salida de Intl varía entre motores (Node vs. navegador): "+90,5 %" y "5 oct 2026".
 * Solo presenta números; ningún cálculo de negocio vive aquí.
 */
const LOCALE = 'es-CO';
const NBSP = ' ';

const integerFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const decimalFormats = new Map<number, Intl.NumberFormat>();

function decimalFormat(maxFractionDigits: number): Intl.NumberFormat {
  let format = decimalFormats.get(maxFractionDigits);
  if (!format) {
    format = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 0, maximumFractionDigits: maxFractionDigits });
    decimalFormats.set(maxFractionDigits, format);
  }
  return format;
}

const isMissing = (value: number | null | undefined): value is null | undefined =>
  value === null || value === undefined || Number.isNaN(value);

/** $110.339.012 — pesos sin decimales. Sin dato → "—" (nunca $0). */
export function formatMoney(value: number | null | undefined): string {
  if (isMissing(value)) return '—';
  const rounded = Math.round(value);
  return `${rounded < 0 ? '-' : ''}$${integerFormat.format(Math.abs(rounded))}`;
}

/** 29.327 — enteros con separador de miles. */
export function formatInt(value: number | null | undefined): string {
  if (isMissing(value)) return '—';
  return integerFormat.format(Math.round(value));
}

/** 1.234,5 — número con hasta `digits` decimales. */
export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (isMissing(value)) return '—';
  return decimalFormat(digits).format(value);
}

/**
 * Porcentaje a partir de un valor ya expresado en puntos (90.5 → "90,5 %").
 * `signed` antepone "+" a los positivos, para variaciones.
 */
export function formatPct(value: number | null | undefined, { signed = false, digits = 1 } = {}): string {
  if (isMissing(value)) return '—';
  const body = decimalFormat(digits).format(Math.abs(value));
  const sign = value < 0 ? '-' : signed && value > 0 ? '+' : '';
  return `${sign}${body}${NBSP}%`;
}

/** Eje de gráficas: $120 M, $850 mil, $900. */
export function formatMoneyCompact(value: number | null | undefined): string {
  if (isMissing(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${decimalFormat(1).format(abs / 1_000_000)}${NBSP}M`;
  if (abs >= 1_000) return `${sign}$${decimalFormat(0).format(abs / 1_000)}${NBSP}mil`;
  return `${sign}$${integerFormat.format(Math.round(abs))}`;
}

/** Eje de gráficas sin moneda: 12,5 mil, 1,2 M. */
export function formatIntCompact(value: number | null | undefined): string {
  if (isMissing(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${decimalFormat(1).format(abs / 1_000_000)}${NBSP}M`;
  if (abs >= 10_000) return `${sign}${decimalFormat(1).format(abs / 1_000)}${NBSP}mil`;
  return `${sign}${integerFormat.format(Math.round(abs))}`;
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Partes de calendario en hora de Colombia. Un día "YYYY-MM-DD" se toma tal cual (sin corrimiento UTC). */
function calendarParts(value: string | Date): { y: number; m: number; d: number } | null {
  if (typeof value === 'string') {
    const day = DAY_RE.exec(value);
    if (day) return { y: Number(day[1]), m: Number(day[2]), d: Number(day[3]) };
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  // Colombia no tiene horario de verano: UTC-5 fijo.
  const bogota = new Date(date.getTime() - 5 * 3_600_000);
  return { y: bogota.getUTCFullYear(), m: bogota.getUTCMonth() + 1, d: bogota.getUTCDate() };
}

/** 5 oct 2026 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const p = calendarParts(value);
  if (!p) return '—';
  return `${p.d} ${MONTHS_SHORT[p.m - 1]} ${p.y}`;
}

/** 5 oct (sin año), para rangos y ejes. */
export function formatDayMonth(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const p = calendarParts(value);
  if (!p) return '—';
  return `${p.d} ${MONTHS_SHORT[p.m - 1]}`;
}

/** 5 oct 2026, 14:32 — fecha y hora de Colombia. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  const bogota = new Date(date.getTime() - 5 * 3_600_000);
  const hh = String(bogota.getUTCHours()).padStart(2, '0');
  const mm = String(bogota.getUTCMinutes()).padStart(2, '0');
  return `${formatDate(date)}, ${hh}:${mm}`;
}

/** octubre 2026 (acepta "YYYY-MM"). */
export function formatMonth(value: string | Date): string {
  const p = calendarParts(typeof value === 'string' && /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value);
  return p ? `${MONTHS_LONG[p.m - 1]} ${p.y}` : '—';
}

/** "1–3 oct 2026", "28 sept – 3 oct 2026", "5 oct 2026" (un solo día). */
export function formatDateRange(from: string, to: string): string {
  const a = calendarParts(from);
  const b = calendarParts(to);
  if (!a || !b) return '—';
  if (a.y === b.y && a.m === b.m && a.d === b.d) return formatDate(from);
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${MONTHS_SHORT[b.m - 1]} ${b.y}`;
  if (a.y === b.y) return `${a.d} ${MONTHS_SHORT[a.m - 1]} – ${b.d} ${MONTHS_SHORT[b.m - 1]} ${b.y}`;
  return `${formatDate(from)} – ${formatDate(to)}`;
}

/** Variación porcentual con 1 decimal (misma regla que el API); null si no hay base. Solo para mostrar. */
export function deltaPct(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
