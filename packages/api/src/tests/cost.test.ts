import express from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  expense: { aggregate: vi.fn(async () => ({ _sum: { valor: null } })) },
  product: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  productCost: { create: vi.fn(), findMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
}));
vi.mock('../config/db.js', () => ({ prisma: db }));
vi.mock('../services/lot.service.js', () => ({ syncFifoCosts: vi.fn(async () => ({ costed: 0, restored: 0, unCovered: 0 })), syncFifoCostsInBackground: vi.fn() }));

const svc = await import('../services/cost.service.js');
const { default: router } = await import('../routes/admin/finance.routes.js');
const { errorHandler } = await import('../middleware/errorHandler.js');

const D = (v: string | number) => new Prisma.Decimal(v);

describe('márgenes', () => {
  it('ejemplo del negocio: venta 100.000, costo 60.000 → utilidad 40.000, margen 40%, recargo 66,67%', () => {
    expect(svc.profitMetrics(100000, 60000)).toEqual({ ingreso: 100000, costo: 60000, utilidad: 40000, margenPct: 40, recargoPct: 66.67 });
  });

  it('margen sobre ventas y recargo sobre costo son distintos y manejan divisores en cero', () => {
    const m = svc.profitMetrics(200, 100);
    expect(m.margenPct).toBe(50);
    expect(m.recargoPct).toBe(100);
    expect(svc.profitMetrics(0, 0)).toMatchObject({ margenPct: null, recargoPct: null, utilidad: 0 });
    expect(svc.profitMetrics(100, 0).recargoPct).toBeNull();
    expect(svc.profitMetrics(50, 80).utilidad).toBe(-30);
  });

  it('usa decimales exactos', () => {
    expect(svc.profitMetrics('0.30', '0.10').utilidad).toBe(0.2);
  });
});

describe('registro de costos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.product.findUnique.mockResolvedValue({ id: 'p1' });
    db.productCost.create.mockImplementation(async ({ data }: any) => ({ id: 'c1', ...data }));
  });

  it('suma costo de adquisición + adicional, crea una fila nueva y NO toca el precio del producto', async () => {
    const created = await svc.setProductCost({ productId: 'p1', costoAdquisicion: 45000.5, costoAdicional: '5000', actorId: 'a' });
    expect(created.costoTotal.toString()).toBe('50000.5');
    expect(db.productCost.create).toHaveBeenCalledOnce();
    expect(db.product.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalled();
  });

  it('valida montos y fechas', async () => {
    for (const bad of [-1, 'abc', 1.234, 1e12, undefined]) {
      await expect(svc.setProductCost({ productId: 'p1', costoAdquisicion: bad, actorId: 'a' })).rejects.toThrow(svc.FinanceError);
    }
    await expect(svc.setProductCost({ productId: 'p1', costoAdquisicion: 10, validFrom: '2999-01-01', actorId: 'a' })).rejects.toThrow();
    await expect(svc.setProductCost({ productId: 'p1', costoAdquisicion: 10, validFrom: '2026-02-30', actorId: 'a' })).rejects.toThrow();
  });

  it('producto inexistente → 404', async () => {
    db.product.findUnique.mockResolvedValue(null);
    await expect(svc.setProductCost({ productId: 'x', costoAdquisicion: 10, actorId: 'a' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('rentabilidad', () => {
  it('separa lo costeado de lo pendiente (nunca asume costo 0) y descuenta comisiones', async () => {
    db.$queryRaw
      .mockResolvedValueOnce([
        { productId: 'p1', sku: 'A', nombre: 'Anillo', categoryId: 'c1', category: 'Anillos', tier: 'por_mayor', units: 10, revenueCosted: '1000000', cogs: '600000', revenuePending: '0', unitsPending: 0 },
        { productId: 'p2', sku: 'B', nombre: 'Cadena', categoryId: 'c2', category: 'Cadenas', tier: 'detal', units: 5, revenueCosted: '0', cogs: '0', revenuePending: '500000', unitsPending: 5 },
      ])
      .mockResolvedValueOnce([{ monto: '30000' }]);
    const report = await svc.getProfitability({ from: '2026-11-01', to: '2026-11-30' });
    expect(report.resumen).toMatchObject({
      ingreso: 1_000_000, costo: 600_000, utilidad: 400_000, margenPct: 40, recargoPct: 66.67,
      ingresoPendienteCosteo: 500_000, unidadesPendientes: 5, comisionesCausadas: 30_000, utilidadDespuesDeComisiones: 370_000, gastosOperativos: 0, resultadoOperativoEstimado: 370_000,
    });
    expect(report.porProducto[0]).toMatchObject({ sku: 'A', utilidad: 400_000 });
    expect(report.porProducto.find((p) => p.sku === 'B')).toMatchObject({ utilidad: 0, margenPct: null, ingresoPendienteCosteo: 500_000 });
    expect(report.notas.join(' ')).toContain('No es utilidad neta');
  });

  it('rechaza fechas inválidas', async () => {
    await expect(svc.getProfitability({ from: '2026-11-30', to: '2026-11-01' })).rejects.toThrow();
  });
});

describe('permisos de costos y rentabilidad', () => {
  function appAs(role: string) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: 'u1', email: 'a@b.co', role, tier: 'detal' } as never;
      next();
    });
    app.use('/api/admin/finance', router);
    app.use(errorHandler);
    return app;
  }

  it('comercial y bodega no acceden a costos, retroactivo ni rentabilidad', async () => {
    for (const role of ['comercial', 'bodega', 'cliente']) {
      const app = appAs(role);
      await request(app).get('/api/admin/finance/costs/products').expect(403);
      await request(app).put('/api/admin/finance/costs/products/11111111-1111-4111-8111-111111111111').send({ costoAdquisicion: 1 }).expect(403);
      await request(app).post('/api/admin/finance/costs/backfill').expect(403);
      await request(app).get('/api/admin/finance/profitability').expect(403);
    }
    expect(db.productCost.create).not.toHaveBeenCalled();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it('admin: ids y modalidad inválidos → 400', async () => {
    const app = appAs('admin');
    await request(app).put('/api/admin/finance/costs/products/basura').send({ costoAdquisicion: 1 }).expect(400);
    await request(app).get('/api/admin/finance/profitability?tier=vip').expect(400);
    await request(app).get('/api/admin/finance/profitability?categoryId=x').expect(400);
  });

  it('retroactivo: solo líneas sin costo, auditado', async () => {
    db.$executeRaw.mockResolvedValue(7);
    const res = await request(appAs('admin')).post('/api/admin/finance/costs/backfill').expect(200);
    expect(res.body.data.updated).toBe(7);
    const sql = (db.$executeRaw.mock.calls[0][0] as unknown as string[]).join(' ');
    expect(sql).toContain('costo_unitario_snapshot IS NULL');
    expect(db.auditLog.create).toHaveBeenCalled();
  });
});
