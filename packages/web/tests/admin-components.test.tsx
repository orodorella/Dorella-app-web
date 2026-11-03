import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import KpiCard, { DeltaText } from '../src/components/admin/KpiCard';
import SetupChecklist from '../src/components/admin/SetupChecklist';
import { request } from '../src/hooks/useApi';

vi.mock('../src/hooks/useApi', () => ({ request: vi.fn() }));
afterEach(() => { cleanup(); vi.mocked(request).mockReset(); });

describe('KpiCard', () => {
  it('sin costo muestra "Falta costo", nunca $0', () => {
    render(<KpiCard label="Utilidad bruta" value="$0" missing="Falta costo" definition="Qué cuenta" />);
    expect(screen.getByText('Falta costo')).toBeTruthy();
    expect(screen.queryByText('$0')).toBeNull();
  });

  it('expone la definición como tooltip accesible', () => {
    render(<KpiCard label="Ventas" value="$1" definition="Ventas = órdenes no canceladas" />);
    expect(screen.getByRole('button', { name: 'Qué cuenta: Ventas' })).toBeTruthy();
    expect(screen.getByRole('tooltip').textContent).toBe('Ventas = órdenes no canceladas');
  });

  it('una tarjeta con enlace no anida el botón de ayuda dentro del <a>', () => {
    const { container } = render(<KpiCard label="Ventas" value="$1" definition="x" href="/admin/rendimiento" />);
    expect(container.querySelector('a button')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/admin/rendimiento');
  });
});

describe('DeltaText', () => {
  it('muestra la variación con signo y el periodo comparado', () => {
    const { container } = render(<DeltaText delta={{ pct: 90.5, label: 'vs. mismo tramo del mes anterior' }} />);
    expect(container.textContent).toContain('+90,5 %');
    expect(screen.getByText('vs. mismo tramo del mes anterior')).toBeTruthy();
  });

  it('sin base de comparación no inventa un porcentaje', () => {
    render(<DeltaText delta={{ pct: null, label: 'vs. ayer' }} />);
    expect(screen.getByText('Sin base de comparación con ayer')).toBeTruthy();
  });
});

describe('SetupChecklist', () => {
  const answer = (data: unknown, meta?: unknown) => Promise.resolve({ success: true, data, meta });

  it('muestra el progreso de costos y enlaza a cada pantalla de configuración', async () => {
    vi.mocked(request).mockImplementation((_m: string, url: string) => {
      if (url.includes('sinCosto=true')) return answer([], { total: 30 });
      if (url.includes('costs/products')) return answer([], { total: 100 });
      return answer({ current: [{ tier: 'detal', userId: null }], history: [] });
    });
    render(<SetupChecklist from="2026-10-01" to="2026-10-31" unidadesSinValorar={12} pendienteCosteo={5000} />);
    await waitFor(() => expect(screen.getByText('0 de 3 pasos listos')).toBeTruthy());
    expect(screen.getByRole('progressbar', { name: 'Productos activos con costo' }).getAttribute('aria-valuenow')).toBe('70');
    expect(screen.getByText('1 de 3 modalidades con porcentaje definido.')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Cargar costos/ }).getAttribute('href')).toBe('/admin/costos?sinCosto=1');
    expect(screen.getByRole('link', { name: /Definir porcentajes/ }).getAttribute('href')).toBe('/admin/comisiones?tab=configuracion');
  });

  it('se oculta cuando todo está configurado', async () => {
    vi.mocked(request).mockImplementation((_m: string, url: string) => {
      if (url.includes('costs/products')) return answer([], { total: url.includes('sinCosto') ? 0 : 10 });
      return answer({ current: ['detal', 'por_mayor', 'gran_mayor'].map((tier) => ({ tier, userId: null })), history: [] });
    });
    const { container } = render(<SetupChecklist from="2026-10-01" to="2026-10-31" unidadesSinValorar={0} />);
    await waitFor(() => expect(vi.mocked(request)).toHaveBeenCalledTimes(3));
    expect(container.textContent).toBe('');
  });
});
