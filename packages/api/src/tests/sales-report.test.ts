import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const queryRaw = vi.hoisted(() => vi.fn());
vi.mock('../config/db.js', () => ({
  prisma: { $queryRaw: queryRaw, user: { findMany: vi.fn(async () => []) } },
}));

const {
  parseSalesFilters, previousPeriod, sharePct, deltaPct, getCommercialPerformance, SalesFilterError, UNASSIGNED_SELLER,
} = await import('../services/sales-report.service.js');
const { default: salesRouter } = await import('../routes/admin/sales.routes.js');
const { errorHandler } = await import('../middleware/errorHandler.js');

describe('filtros de ventas', () => {
  it('usa los últimos 30 días por defecto', () => {
    const f = parseSalesFilters({}, new Date('2026-11-30T12:00:00Z'));
    expect(f).toMatchObject({ from: '2026-11-01', to: '2026-11-30', granularity: 'day' });
  });

  it('rechaza fechas, ids, modalidades y estados inválidos', () => {
    expect(() => parseSalesFilters({ from: '2026-13-40' })).toThrow(SalesFilterError);
    expect(() => parseSalesFilters({ from: '2026-05-02', to: '2026-05-01' })).toThrow(SalesFilterError);
    expect(() => parseSalesFilters({ sellerId: "x'; DROP TABLE orders;--" })).toThrow(SalesFilterError);
    expect(() => parseSalesFilters({ tier: 'vip' })).toThrow(SalesFilterError);
    expect(() => parseSalesFilters({ status: 'foo' })).toThrow(SalesFilterError);
    expect(() => parseSalesFilters({ granularity: "day'; --" })).toThrow(SalesFilterError);
    expect(() => parseSalesFilters({ from: '2020-01-01', to: '2026-01-01' })).toThrow(SalesFilterError);
  });

  it('acepta "sin-asignar" como comercial', () => {
    expect(parseSalesFilters({ sellerId: UNASSIGNED_SELLER }).sellerId).toBe(UNASSIGNED_SELLER);
  });
});

describe('periodos y porcentajes', () => {
  it('el periodo anterior tiene la misma duración y termina el día previo', () => {
    expect(previousPeriod('2026-11-01', '2026-11-30')).toEqual({ from: '2026-10-02', to: '2026-10-31' });
    expect(previousPeriod('2026-03-01', '2026-03-01')).toEqual({ from: '2026-02-28', to: '2026-02-28' });
  });

  it('sharePct y deltaPct manejan divisiones por cero', () => {
    expect(sharePct(25, 100)).toBe(25);
    expect(sharePct(1, 3)).toBe(33.3);
    expect(sharePct(5, 0)).toBeNull();
    expect(deltaPct(150, 100)).toBe(50);
    expect(deltaPct(50, 100)).toBe(-50);
    expect(deltaPct(10, 0)).toBeNull();
  });
});

describe('consolidación del reporte', () => {
  it('agrupa por vendedor y modalidad, separa "sin comercial asignado" y calcula ticket y participación', async () => {
    queryRaw.mockReset();
    const rows = [
      { sellerId: 's1', sellerName: 'Ana Pérez', tier: 'por_mayor', orders: 2, units: 10, revenue: '8000000', paidRevenue: '5000000' },
      { sellerId: 's1', sellerName: 'Ana Pérez', tier: 'gran_mayor', orders: 1, units: 20, revenue: '12000000', paidRevenue: '12000000' },
      { sellerId: null, sellerName: null, tier: 'detal', orders: 1, units: 1, revenue: '100000', paidRevenue: '0' },
    ];
    queryRaw
      .mockResolvedValueOnce(rows) // periodo actual
      .mockResolvedValueOnce([{ sellerId: 's1', sellerName: 'Ana Pérez', tier: 'detal', orders: 1, units: 1, revenue: '10000000', paidRevenue: '0' }]) // anterior
      .mockResolvedValueOnce([]) // timeline
      .mockResolvedValueOnce([{ categoryId: 'c1', category: 'Anillos', sellerId: 's1', units: 30, revenue: '20000000' }])
      .mockResolvedValueOnce([{ sellerId: 's1', orders: 3 }, { sellerId: null, orders: 1 }]);

    const report = await getCommercialPerformance(parseSalesFilters({ from: '2026-11-01', to: '2026-11-30' }));
    const ana = report.sellers.find((s) => s.sellerId === 's1')!;
    const none = report.sellers.find((s) => s.sellerId === UNASSIGNED_SELLER)!;

    expect(ana.revenue).toBe(20_000_000);
    expect(ana.byTier.por_mayor.revenue).toBe(8_000_000);
    expect(ana.byTier.gran_mayor.revenue).toBe(12_000_000);
    expect(ana.byTier.detal.revenue).toBe(0);
    expect(ana.orders).toBe(3);
    expect(ana.ticketPromedio).toBe(6_666_667);
    expect(ana.variacionPct).toBe(100);
    expect(none.nombre).toBe('Sin comercial asignado');
    expect(report.totals.revenue).toBe(20_100_000);
    expect(report.totals.orders).toBe(4);
    expect(ana.participacionPct).toBe(99.5);
    expect(report.byTier.find((t) => t.tier === 'gran_mayor')!.revenue).toBe(12_000_000);
    expect(report.byCategory[0]).toMatchObject({ category: 'Anillos', revenue: 20_000_000 });
  });
});

describe('permisos del reporte', () => {
  function appAs(role: string) {
    const app = express();
    app.use((req, _res, next) => {
      req.user = { id: 'u1', email: 'a@b.co', role, tier: 'detal' } as never;
      next();
    });
    app.use('/api/admin/sales', salesRouter);
    app.use(errorHandler);
    return app;
  }

  it('solo admin consulta el rendimiento comercial', async () => {
    await request(appAs('comercial')).get('/api/admin/sales/performance').expect(403);
    await request(appAs('bodega')).get('/api/admin/sales/performance').expect(403);
    await request(appAs('cliente')).get('/api/admin/sales/sellers').expect(403);
  });

  it('filtros inválidos devuelven 400 para admin', async () => {
    await request(appAs('admin')).get('/api/admin/sales/performance?tier=vip').expect(400);
  });
});
