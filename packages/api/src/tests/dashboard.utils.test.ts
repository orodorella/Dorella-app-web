import { describe, it, expect } from 'vitest';
import { buildRange, pctDelta, toNumber, CONFIRMED_STATUSES } from '../services/dashboard.utils.js';

describe('buildRange', () => {
  it('normaliza days a 7, 30 o 90 (default 30)', () => {
    const now = new Date('2026-08-07T15:30:00');
    expect(buildRange(7, now).days).toBe(7);
    expect(buildRange(30, now).days).toBe(30);
    expect(buildRange(90, now).days).toBe(90);
    expect(buildRange(undefined as unknown as number, now).days).toBe(30);
    expect(buildRange(45, now).days).toBe(30);
  });

  it('construye ventanas [start, prevStart, prevEnd] de días completos', () => {
    const now = new Date('2026-08-07T15:30:00');
    const r = buildRange(7, now);
    expect(r.start.getDate()).toBe(1); // 07 - 6 días
    expect(r.start.getHours()).toBe(0);
    expect(r.start.getMinutes()).toBe(0);
    expect(r.prevEnd.getTime()).toBe(r.start.getTime());
    expect(r.prevStart.getDate()).toBe(25); // 1 - 7 días (julio)
    expect(r.prevStart.getMonth()).toBe(6); // julio
  });

  it('incluye el día actual en la ventana', () => {
    const now = new Date('2026-08-07T00:00:01');
    const r = buildRange(30, now);
    expect(r.start.getDate()).toBe(9); // 09 jul
    expect(r.start.getMonth()).toBe(6);
  });
});

describe('pctDelta', () => {
  it('calcula cambio porcentual', () => {
    expect(pctDelta(150, 100)).toBeCloseTo(50);
    expect(pctDelta(50, 100)).toBeCloseTo(-50);
    expect(pctDelta(100, 100)).toBe(0);
  });

  it('devuelve null cuando el periodo anterior es 0', () => {
    expect(pctDelta(100, 0)).toBeNull();
    expect(pctDelta(0, 0)).toBeNull();
    expect(pctDelta(100, -1)).toBeNull();
  });
});

describe('toNumber', () => {
  it('convierte string, Decimal-like y nulls', () => {
    expect(toNumber('123.45')).toBe(123.45);
    expect(toNumber(42)).toBe(42);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber(Number.NaN)).toBe(0);
    expect(toNumber({ toNumber: () => 7 })).toBe(7);
  });
});

describe('CONFIRMED_STATUSES', () => {
  it('solo incluye estados que aportan ingreso', () => {
    expect(CONFIRMED_STATUSES).toEqual(['confirmed', 'invoiced', 'shipped', 'delivered']);
    expect(CONFIRMED_STATUSES).not.toContain('pending');
    expect(CONFIRMED_STATUSES).not.toContain('cancelled');
  });
});
