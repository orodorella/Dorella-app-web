import { describe, expect, it } from 'vitest';
import { apiPreviousPeriod, DASHBOARD_PRESETS, periodFromParams, periodToParams, resolvePeriod, todayBogota } from '../src/lib/admin-period';

// 3 nov 2026, 10:00 en Colombia.
const NOW = new Date('2026-11-03T15:00:00.000Z');

describe('periodo compartido del panel', () => {
  it('usa la fecha de Colombia, no la UTC', () => {
    expect(todayBogota(new Date('2026-11-04T03:00:00.000Z'))).toBe('2026-11-03');
  });

  it('30 días es el predeterminado y se compara contra los 30 anteriores (igual que el API)', () => {
    const p = periodFromParams(new URLSearchParams(), undefined, NOW);
    expect(p).toMatchObject({ preset: '30d', from: '2026-10-05', to: '2026-11-03', days: 30, partial: false });
    expect(p.comparison).toMatchObject({ from: '2026-09-05', to: '2026-10-04', matchesApi: true, label: 'vs. los 30 días anteriores' });
  });

  it('este mes es parcial y se compara con el mismo tramo del mes anterior', () => {
    const p = resolvePeriod('mes', {}, NOW);
    expect(p).toMatchObject({ from: '2026-11-01', to: '2026-11-03', partial: true });
    expect(p.comparison).toMatchObject({ from: '2026-10-01', to: '2026-10-03', label: 'vs. mismo tramo del mes anterior', matchesApi: false });
    expect(p.comparison.rangeLabel).toBe('1–3 oct 2026');
  });

  it('el tramo comparable no se sale del mes anterior más corto', () => {
    const p = resolvePeriod('mes', {}, new Date('2026-03-31T15:00:00.000Z'));
    expect(p.partial).toBe(false);
    expect(p.comparison).toMatchObject({ from: '2026-02-01', to: '2026-02-28', label: 'vs. febrero 2026' });
  });

  it('mes pasado se compara con el mes completo anterior', () => {
    const p = resolvePeriod('mes-pasado', {}, NOW);
    expect(p).toMatchObject({ from: '2026-10-01', to: '2026-10-31', partial: false });
    expect(p.comparison).toMatchObject({ from: '2026-09-01', to: '2026-09-30', label: 'vs. septiembre 2026' });
  });

  it('hoy se compara con ayer', () => {
    const p = resolvePeriod('hoy', {}, NOW);
    expect(p).toMatchObject({ from: '2026-11-03', to: '2026-11-03', days: 1 });
    expect(p.comparison).toMatchObject({ from: '2026-11-02', to: '2026-11-02', label: 'vs. ayer', matchesApi: true });
  });

  it('personalizado válido se respeta; inválido cae al predeterminado', () => {
    expect(resolvePeriod('custom', { from: '2026-08-01', to: '2026-08-15' }, NOW)).toMatchObject({ preset: 'custom', from: '2026-08-01', to: '2026-08-15', label: '1–15 ago 2026' });
    expect(resolvePeriod('custom', { from: '2026-08-15', to: '2026-08-01' }, NOW).preset).toBe('30d');
    expect(resolvePeriod('custom', { from: '2026-02-30', to: '2026-03-01' }, NOW).preset).toBe('30d');
  });

  it('una pantalla que no admite el periodo de la URL usa su predeterminado', () => {
    expect(periodFromParams(new URLSearchParams('periodo=mes'), DASHBOARD_PRESETS, NOW).preset).toBe('30d');
    expect(periodFromParams(new URLSearchParams('periodo=90d'), DASHBOARD_PRESETS, NOW).days).toBe(90);
  });

  it('serializa a la URL conservando otros filtros', () => {
    const next = periodToParams(new URLSearchParams('comercial=abc&periodo=mes'), 'custom', { from: '2026-08-01', to: '2026-08-15' });
    expect(next.toString()).toBe('comercial=abc&periodo=custom&desde=2026-08-01&hasta=2026-08-15');
    expect(periodToParams(next, '30d').toString()).toBe('comercial=abc');
  });

  it('periodo anterior idéntico al del API', () => {
    expect(apiPreviousPeriod('2026-11-01', '2026-11-03')).toEqual({ from: '2026-10-29', to: '2026-10-31' });
  });
});
