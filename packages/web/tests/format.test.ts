import { describe, expect, it } from 'vitest';
import { deltaPct, formatDate, formatDateRange, formatDateTime, formatInt, formatMoney, formatMoneyCompact, formatMonth, formatPct } from '../src/lib/format';
import { formatCOP } from '../src/lib/api-client';

const NBSP = ' ';

describe('formato es-CO', () => {
  it('dinero sin decimales con punto de miles', () => {
    expect(formatMoney(110339012)).toBe('$110.339.012');
    expect(formatMoney(1234.6)).toBe('$1.235');
    expect(formatMoney(0)).toBe('$0');
    expect(formatMoney(-2500)).toBe('-$2.500');
    expect(formatMoney(null)).toBe('—');
  });

  it('formatCOP conserva su salida y delega en la utilidad única', () => {
    expect(formatCOP(110339012)).toBe('$110.339.012');
    expect(formatCOP(undefined)).toBe('—');
  });

  it('miles', () => {
    expect(formatInt(29327)).toBe('29.327');
    expect(formatInt(250405)).toBe('250.405');
  });

  it('porcentajes con coma decimal y espacio', () => {
    expect(formatPct(90.5, { signed: true })).toBe(`+90,5${NBSP}%`);
    expect(formatPct(-98.7, { signed: true })).toBe(`-98,7${NBSP}%`);
    expect(formatPct(37.5)).toBe(`37,5${NBSP}%`);
    expect(formatPct(0, { signed: true })).toBe(`0${NBSP}%`);
    expect(formatPct(null)).toBe('—');
  });

  it('ejes compactos', () => {
    expect(formatMoneyCompact(120_000_000)).toBe(`$120${NBSP}M`);
    expect(formatMoneyCompact(1_500_000)).toBe(`$1,5${NBSP}M`);
    expect(formatMoneyCompact(850_000)).toBe(`$850${NBSP}mil`);
    expect(formatMoneyCompact(900)).toBe('$900');
  });

  it('fechas cortas sin corrimiento de zona', () => {
    expect(formatDate('2026-10-05')).toBe('5 oct 2026');
    // 02:00 UTC del 6 = 21:00 del 5 en Colombia.
    expect(formatDate('2026-10-06T02:00:00.000Z')).toBe('5 oct 2026');
    expect(formatDateTime('2026-10-06T02:05:00.000Z')).toBe('5 oct 2026, 21:05');
    expect(formatMonth('2026-09')).toBe('septiembre 2026');
  });

  it('rangos de fechas', () => {
    expect(formatDateRange('2026-10-01', '2026-10-03')).toBe('1–3 oct 2026');
    expect(formatDateRange('2026-09-28', '2026-10-03')).toBe('28 sept – 3 oct 2026');
    expect(formatDateRange('2026-10-05', '2026-10-05')).toBe('5 oct 2026');
    expect(formatDateRange('2025-12-30', '2026-01-02')).toBe('30 dic 2025 – 2 ene 2026');
  });

  it('variación igual a la regla del API', () => {
    expect(deltaPct(150, 100)).toBe(50);
    expect(deltaPct(1, 77)).toBe(-98.7);
    expect(deltaPct(5, 0)).toBeNull();
  });
});
