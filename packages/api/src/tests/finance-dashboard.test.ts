import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  performance: vi.fn(),
  profitability: vi.fn(),
  expenseSummary: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock('../config/db.js', () => ({ prisma: { $queryRaw: mocks.queryRaw } }));
vi.mock('../services/sales-report.service.js', async () => {
  const actual = await vi.importActual<typeof import('../services/sales-report.service.js')>('../services/sales-report.service.js');
  return { ...actual, getCommercialPerformance: mocks.performance };
});
vi.mock('../services/cost.service.js', () => ({ getProfitability: mocks.profitability, FinanceError: class extends Error {} }));
vi.mock('../services/expense.service.js', () => ({ getExpenseSummary: mocks.expenseSummary }));
vi.mock('../services/lot.service.js', () => ({
  getInventoryValuation: vi.fn(async () => ({ resumen: { comprasPeriodo: 5_000_000, inventarioValorizado: 12_000_000, costoPromedioUnitario: 40_000, unidadesValoradas: 300, unidadesSinValorar: 20 } })),
}));

const { getFinancialDashboard, financialDashboardToCsv } = await import('../services/finance-dashboard.service.js');
const { default: router } = await import('../routes/admin/finance.routes.js');
const { errorHandler } = await import('../middleware/errorHandler.js');

function seed() {
  mocks.performance.mockResolvedValue({
    totals: { revenue: 30_000_000, orders: 12, ticketPromedio: 2_500_000, variacionPct: 10 },
    sellers: [{ sellerId: 's1', nombre: 'Ana', revenue: 20_000_000, orders: 8, participacionPct: 66.7 }, { sellerId: 'sin-asignar', nombre: 'Sin comercial asignado', revenue: 10_000_000, orders: 4, participacionPct: 33.3 }],
    byTier: [{ tier: 'detal', revenue: 5_000_000, units: 5 }, { tier: 'por_mayor', revenue: 10_000_000, units: 10 }, { tier: 'gran_mayor', revenue: 15_000_000, units: 20 }],
  });
  mocks.profitability.mockResolvedValue({
    resumen: { ingreso: 25_000_000, costo: 15_000_000, utilidad: 10_000_000, margenPct: 40, ingresoPendienteCosteo: 2_000_000, comisionesCausadas: 400_000, resultadoOperativoEstimado: 8_600_000 },
  });
  mocks.expenseSummary.mockResolvedValue({
    total: 1_000_000, porCategoria: [{ categoria: 'Vuelos', total: 600_000 }], comparativoMensual: { mesActual: 1, mesAnterior: 1, variacionPct: 0 },
  });
  mocks.queryRaw.mockResolvedValue([{ causadaSinPagar: '300000', ajustesPendientes: '-50000' }]);
}

describe('dashboard financiero', () => {
  beforeEach(() => { vi.clearAllMocks(); seed(); });

  it('consolida ventas, utilidad, comisiones, gastos y resultado sin recalcular métricas', async () => {
    const d = await getFinancialDashboard('2026-11-01', '2026-11-30');
    expect(d.ventas.total).toBe(30_000_000);
    expect(d.rentabilidad).toMatchObject({ utilidadBruta: 10_000_000, margenBrutoPct: 40, ingresoPendienteCosteo: 2_000_000 });
    expect(d.comisiones).toEqual({ causadasEnPeriodo: 400_000, porPagar: 250_000 });
    expect(d.gastos.total).toBe(1_000_000);
    expect(d.inventario).toMatchObject({ comprasPeriodo: 5_000_000, inventarioValorizado: 12_000_000, unidadesSinValorar: 20 });
    expect(d.advertencias.join(' ')).toMatch(/sin valorar/);
    // resultado = utilidad bruta (10M) − comisiones (0,4M) − gastos (1M) calculado una sola vez en rentabilidad
    expect(d.resultadoOperativoEstimado).toBe(8_600_000);
    expect(d.advertencias.join(' ')).toMatch(/no es utilidad neta/);
    expect(d.advertencias.join(' ')).toMatch(/pendientes de costeo/);
  });

  it('el CSV deja los negativos numéricos y lista comerciales y categorías', async () => {
    mocks.profitability.mockResolvedValue({ resumen: { ingreso: 0, costo: 0, utilidad: 0, margenPct: null, ingresoPendienteCosteo: 0, comisionesCausadas: 0, resultadoOperativoEstimado: -500_000 } });
    const csv = financialDashboardToCsv(await getFinancialDashboard('2026-11-01', '2026-11-30'));
    expect(csv).toContain('Resultado operativo estimado,-500000');
    expect(csv).toContain('Ventas · Ana,20000000');
    expect(csv).toContain('Gastos · Vuelos,600000');
  });

  it('rechaza fechas inválidas', async () => {
    await expect(getFinancialDashboard('2026-02-30', '2026-03-01')).rejects.toThrow();
  });
});

describe('permisos del dashboard financiero', () => {
  function appAs(role: string) {
    const app = express();
    app.use((req, _res, next) => { req.user = { id: 'u', email: 'a@b.co', role, tier: 'detal' } as never; next(); });
    app.use('/api/admin/finance', router);
    app.use(errorHandler);
    return app;
  }

  it('solo admin: comercial, bodega y cliente reciben 403 sin invocar los servicios', async () => {
    for (const role of ['comercial', 'bodega', 'cliente']) {
      await request(appAs(role)).get('/api/admin/finance/summary').expect(403);
      await request(appAs(role)).get('/api/admin/finance/summary/export').expect(403);
    }
    expect(mocks.performance).not.toHaveBeenCalled();
    expect(mocks.profitability).not.toHaveBeenCalled();
  });

  it('admin obtiene el resumen y el CSV; fecha inválida → 400', async () => {
    seed();
    await request(appAs('admin')).get('/api/admin/finance/summary?from=2026-11-01&to=2026-11-30').expect(200);
    const csv = await request(appAs('admin')).get('/api/admin/finance/summary/export?from=2026-11-01&to=2026-11-30').expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    await request(appAs('admin')).get('/api/admin/finance/summary?from=2026-02-30&to=2026-03-01').expect(400);
  });
});
