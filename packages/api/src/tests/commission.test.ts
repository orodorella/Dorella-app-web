import express from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => {
  const mock: Record<string, any> = {
    commissionRule: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    order: { findMany: vi.fn() },
    commissionEntry: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn(async () => 0) },
    commissionAdjustment: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    commissionLiquidation: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  mock.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(mock));
  return mock;
});
vi.mock('../config/db.js', () => ({ prisma: db }));

const svc = await import('../services/commission.service.js');
const { default: router } = await import('../routes/admin/commissions.routes.js');
const { errorHandler } = await import('../middleware/errorHandler.js');

const D = (v: string | number) => new Prisma.Decimal(v);
const rule = (over: Record<string, unknown>) => ({ id: 'r', tier: 'por_mayor', userId: null, porcentaje: D(2), validFrom: new Date('2026-01-01T00:00:00Z'), validTo: null, ...over });

describe('cálculo monetario', () => {
  it('reproduce el ejemplo del negocio: 2% de 10M + 1% de 20M = 400.000', () => {
    const a = svc.calculateCommission('10000000', '2');
    const b = svc.calculateCommission('20000000', '1');
    expect(a.toString()).toBe('200000');
    expect(b.toString()).toBe('200000');
    expect(a.add(b).toString()).toBe('400000');
  });

  it('no usa float: 0.1+0.2 style y redondeo a centavos mitad hacia arriba', () => {
    expect(svc.calculateCommission('0.10', '0.2').toString()).toBe('0');
    expect(svc.calculateCommission('33.33', '1.5').toString()).toBe('0.5');
    expect(svc.calculateCommission('100.05', '1').toString()).toBe('1');
    expect(svc.calculateCommission('1234567.89', '2.5').toString()).toBe('30864.2');
  });

  it('valida el porcentaje (0-100, máx. 4 decimales)', () => {
    expect(svc.parsePercentage('2.5').toString()).toBe('2.5');
    for (const bad of [-1, 101, 'abc', 1.23456, NaN, undefined, null]) {
      expect(() => svc.parsePercentage(bad)).toThrow(svc.CommissionError);
    }
  });
});

describe('vigencias de reglas', () => {
  it('usa el porcentaje vigente en la fecha, no el actual', () => {
    const old = rule({ id: 'old', porcentaje: D(2), validFrom: new Date('2026-01-01Z'), validTo: new Date('2026-06-01Z') });
    const fresh = rule({ id: 'new', porcentaje: D(3), validFrom: new Date('2026-06-01Z') });
    expect(svc.resolveRuleAt([old, fresh] as never, 's', 'por_mayor', new Date('2026-05-31Z'))?.id).toBe('old');
    expect(svc.resolveRuleAt([old, fresh] as never, 's', 'por_mayor', new Date('2026-06-01Z'))?.id).toBe('new');
    expect(svc.resolveRuleAt([old, fresh] as never, 's', 'por_mayor', new Date('2025-12-31Z'))).toBeNull();
  });

  it('la regla del comercial prevalece sobre la general y no mezcla modalidades', () => {
    const general = rule({ id: 'g', porcentaje: D(2) });
    const special = rule({ id: 's1', userId: 'seller-1', porcentaje: D(4) });
    const at = new Date('2026-07-01Z');
    expect(svc.resolveRuleAt([general, special] as never, 'seller-1', 'por_mayor', at)?.id).toBe('s1');
    expect(svc.resolveRuleAt([general, special] as never, 'seller-2', 'por_mayor', at)?.id).toBe('g');
    expect(svc.resolveRuleAt([general, special] as never, 'seller-1', 'detal', at)).toBeNull();
  });
});

describe('causación y reversos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));
    db.commissionEntry.findMany.mockResolvedValue([]);
  });

  it('causa con instantánea del porcentaje vigente al pagar (aunque hoy haya otro)', async () => {
    db.commissionRule.findMany.mockResolvedValue([
      rule({ id: 'old', porcentaje: D(2), validFrom: new Date('2026-01-01Z'), validTo: new Date('2026-06-01Z') }),
      rule({ id: 'new', porcentaje: D(5), validFrom: new Date('2026-06-01Z') }),
    ]);
    db.order.findMany.mockResolvedValueOnce([{
      id: 'o1', sellerId: 's1', tierAtPurchase: 'por_mayor', paidAt: new Date('2026-03-10Z'), updatedAt: new Date(),
      items: [{ subtotal: D('6000000') }, { subtotal: D('4000000') }],
    }]);
    const result = await svc.syncCommissionEntries();
    expect(result.accrued).toBe(1);
    const data = db.commissionEntry.create.mock.calls[0][0].data;
    expect(data.base.toString()).toBe('10000000');
    expect(data.porcentaje.toString()).toBe('2');
    expect(data.monto.toString()).toBe('200000');
    expect(data.ruleId).toBe('old');
  });

  it('la causación usa el rol del vendedor al crear la orden (un cambio de rol posterior no la pierde)', async () => {
    db.commissionRule.findMany.mockResolvedValue([]);
    db.order.findMany.mockResolvedValueOnce([]);
    await svc.syncCommissionEntries();
    const where = db.order.findMany.mock.calls.at(-1)[0].where;
    expect(JSON.stringify(where.OR)).toContain('"sellerRole":"comercial"');
    // Órdenes anteriores (sin dato) siguen dependiendo del rol actual
    expect(JSON.stringify(where.OR)).toContain('"sellerRole":null');
  });

  it('la comisión estimada del resumen también usa el rol de la orden, no el actual', async () => {
    db.commissionRule.findMany.mockResolvedValue([]);
    db.order.findMany.mockResolvedValue([]);
    db.commissionEntry.findMany.mockResolvedValue([]);
    db.commissionAdjustment.groupBy = vi.fn(async () => []);
    db.user.findMany = vi.fn(async () => []);
    db.$queryRaw = vi.fn(async () => []);
    await svc.getCommissionSummary('2026-11-01', '2026-11-30');
    const sqls = db.$queryRaw.mock.calls.map((c: any[]) => (c[0] as string[]).join(' '));
    expect(sqls.some((q: string) => q.includes("COALESCE(o.seller_role, u.role::text) = 'comercial'"))).toBe(true);
  });

  it('sin regla definida causa 0% (no inventa porcentajes)', async () => {
    db.commissionRule.findMany.mockResolvedValue([]);
    db.order.findMany.mockResolvedValueOnce([{ id: 'o1', sellerId: 's1', tierAtPurchase: 'detal', paidAt: new Date(), updatedAt: new Date(), items: [{ subtotal: D(100000) }] }]);
    await svc.syncCommissionEntries();
    expect(db.commissionEntry.create.mock.calls[0][0].data.monto.toString()).toBe('0');
  });

  it('es idempotente: una causación duplicada (P2002) no falla ni duplica', async () => {
    db.commissionRule.findMany.mockResolvedValue([rule({})]);
    db.order.findMany.mockResolvedValueOnce([{ id: 'o1', sellerId: 's1', tierAtPurchase: 'por_mayor', paidAt: new Date(), updatedAt: new Date(), items: [{ subtotal: D(1000) }] }]);
    db.commissionEntry.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
    await expect(svc.syncCommissionEntries()).resolves.toMatchObject({ accrued: 0 });
  });

  it('anula la comisión de una orden cancelada si aún no está liquidada', async () => {
    db.commissionRule.findMany.mockResolvedValue([]);
    db.order.findMany.mockResolvedValue([]);
    db.commissionEntry.findMany.mockResolvedValue([{ id: 'e1', sellerId: 's1', monto: D(200000), liquidationId: null, order: { orderNumber: 'DOR-1' } }]);
    db.commissionEntry.updateMany.mockResolvedValue({ count: 1 });
    const result = await svc.syncCommissionEntries();
    expect(result.voided).toBe(1);
    expect(db.commissionEntry.updateMany.mock.calls[0][0].data.status).toBe('voided');
    expect(db.commissionAdjustment.create).not.toHaveBeenCalled();
  });

  it('si ya estaba liquidada, no reescribe: crea un ajuste negativo único', async () => {
    db.commissionRule.findMany.mockResolvedValue([]);
    db.order.findMany.mockResolvedValue([]);
    db.commissionEntry.findMany.mockResolvedValue([{ id: 'e1', sellerId: 's1', monto: D(200000), liquidationId: 'L1', order: { orderNumber: 'DOR-1' } }]);
    db.commissionEntry.updateMany.mockResolvedValue({ count: 1 });
    const result = await svc.syncCommissionEntries();
    expect(result.clawbacks).toBe(1);
    const adj = db.commissionAdjustment.create.mock.calls[0][0].data;
    expect(adj.monto.toString()).toBe('-200000');
    expect(adj.entryId).toBe('e1');
    // una segunda pasada ya no la encuentra (voidedAt marcado) -> sin duplicar
    db.commissionEntry.updateMany.mockResolvedValue({ count: 0 });
    db.commissionAdjustment.create.mockClear();
    await svc.syncCommissionEntries();
    expect(db.commissionAdjustment.create).not.toHaveBeenCalled();
  });
});

describe('reglas, liquidaciones y ajustes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));
    db.commissionRule.findMany.mockResolvedValue([]);
    db.order.findMany.mockResolvedValue([]);
    db.commissionEntry.findMany.mockResolvedValue([]);
  });

  it('cambiar un porcentaje cierra la regla anterior y crea otra (no edita el historial)', async () => {
    const open = rule({ id: 'open', porcentaje: D(2) });
    db.commissionRule.findFirst.mockResolvedValue(open);
    db.commissionRule.create.mockResolvedValue({ id: 'n', porcentaje: D(3) });
    await svc.setCommissionRule({ tier: 'por_mayor', porcentaje: 3, actorId: 'a', now: new Date('2026-08-01Z') });
    expect(db.commissionRule.update.mock.calls[0][0]).toMatchObject({ where: { id: 'open' }, data: { validTo: new Date('2026-08-01Z') } });
    expect(db.commissionRule.create.mock.calls[0][0].data.porcentaje.toString()).toBe('3');
    expect(db.auditLog.create).toHaveBeenCalled();
  });

  it('un cambio al mismo valor no crea reglas nuevas', async () => {
    db.commissionRule.findFirst.mockResolvedValue(rule({ id: 'open', porcentaje: D(2) }));
    await svc.setCommissionRule({ tier: 'por_mayor', porcentaje: '2.0000', actorId: 'a' });
    expect(db.commissionRule.create).not.toHaveBeenCalled();
  });

  it('liquidar suma comisiones y ajustes y rechaza el periodo vacío', async () => {
    db.user.findUnique.mockResolvedValue({ id: 's1', role: 'comercial' });
    db.commissionEntry.findMany
      .mockResolvedValueOnce([]) // sync: por revertir
      .mockResolvedValueOnce([{ id: 'e1', monto: D(200000) }, { id: 'e2', monto: D(200000) }]);
    db.commissionAdjustment.findMany.mockResolvedValue([{ id: 'a1', monto: D(-50000) }]);
    db.commissionLiquidation.create.mockImplementation(async ({ data }: any) => ({ id: 'L1', ...data }));
    db.commissionEntry.updateMany.mockResolvedValue({ count: 2 });
    db.commissionAdjustment.updateMany.mockResolvedValue({ count: 1 });
    const liq = await svc.createLiquidation({ sellerId: 's1', from: '2026-08-01', to: '2026-08-31', actorId: 'a' });
    expect(liq.subtotal.toString()).toBe('400000');
    expect(liq.ajustes.toString()).toBe('-50000');
    expect(liq.total.toString()).toBe('350000');
    // El reclamo exige que la entrada siga causada y no anulada (evita liquidar una entrada anulada en paralelo).
    expect(db.commissionEntry.updateMany.mock.calls.at(-1)![0].where).toMatchObject({ liquidationId: null, status: 'accrued', voidedAt: null });

    db.commissionEntry.findMany.mockResolvedValue([]);
    db.commissionAdjustment.findMany.mockResolvedValue([]);
    await expect(svc.createLiquidation({ sellerId: 's1', from: '2026-09-01', to: '2026-09-30', actorId: 'a' })).rejects.toMatchObject({ code: 'NOTHING_TO_LIQUIDATE' });
  });

  it('aborta si otra liquidación reclamó las mismas filas (condición de carrera)', async () => {
    db.user.findUnique.mockResolvedValue({ id: 's1', role: 'comercial' });
    db.commissionEntry.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'e1', monto: D(100) }]);
    db.commissionAdjustment.findMany.mockResolvedValue([]);
    db.commissionLiquidation.create.mockResolvedValue({ id: 'L2', total: D(100) });
    db.commissionEntry.updateMany.mockResolvedValue({ count: 0 });
    db.commissionAdjustment.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.createLiquidation({ sellerId: 's1', from: '2026-08-01', to: '2026-08-31', actorId: 'a' })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('marcar como pagada es idempotente', async () => {
    db.commissionLiquidation.findUnique.mockResolvedValue({ id: 'L1', status: 'paid', total: D(1) });
    await svc.markLiquidationPaid('L1', 'a');
    expect(db.commissionLiquidation.updateMany).not.toHaveBeenCalled();
    expect(db.commissionEntry.updateMany).not.toHaveBeenCalled();
  });

  it('valida ajustes: monto no cero, motivo obligatorio y solo comerciales', async () => {
    await expect(svc.addAdjustment({ sellerId: 's', monto: 0, motivo: 'abc', actorId: 'a' })).rejects.toThrow(svc.CommissionError);
    await expect(svc.addAdjustment({ sellerId: 's', monto: 10.123, motivo: 'abc', actorId: 'a' })).rejects.toThrow(svc.CommissionError);
    await expect(svc.addAdjustment({ sellerId: 's', monto: 'abc', motivo: 'abc', actorId: 'a' })).rejects.toThrow(svc.CommissionError);
    await expect(svc.addAdjustment({ sellerId: 's', monto: 10, motivo: ' ', actorId: 'a' })).rejects.toThrow(svc.CommissionError);
    db.user.findUnique.mockResolvedValue({ role: 'cliente' });
    await expect(svc.addAdjustment({ sellerId: 's', monto: 10, motivo: 'bono', actorId: 'a' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('el CSV neutraliza fórmulas y escapa comillas', () => {
    const csv = svc.liquidationToCsv({
      id: 'x', sellerName: '=HYPERLINK("http://x")', periodFrom: '2026-08-01', periodTo: '2026-08-31', subtotal: 1, ajustes: 0, total: 1,
      status: 'pending', createdAt: '', paidAt: null,
      entries: [{ orderNumber: 'DOR-1', tier: 'detal', base: 1, porcentaje: 1, monto: 1, status: 'accrued', accruedAt: '' }],
      adjustments: [{ monto: -5, motivo: '@cmd, "x"', createdAt: '' }],
    });
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain(`'=HYPERLINK`);
    expect(csv).toContain(`"'@cmd, ""x"""`);
  });
});

describe('permisos de comisiones', () => {
  function appAs(role: string) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: 'u1', email: 'a@b.co', role, tier: 'detal' } as never;
      next();
    });
    app.use('/api/admin/commissions', router);
    app.use(errorHandler);
    return app;
  }

  it('comercial y bodega no ven ni cambian porcentajes, liquidaciones ni ajustes', async () => {
    for (const role of ['comercial', 'bodega', 'cliente']) {
      const app = appAs(role);
      await request(app).get('/api/admin/commissions/rules').expect(403);
      await request(app).put('/api/admin/commissions/rules').send({ tier: 'detal', porcentaje: 99 }).expect(403);
      await request(app).get('/api/admin/commissions/summary').expect(403);
      await request(app).post('/api/admin/commissions/liquidations').send({}).expect(403);
      await request(app).post('/api/admin/commissions/liquidations/x/pay').expect(403);
      await request(app).post('/api/admin/commissions/adjustments').send({}).expect(403);
    }
    expect(db.commissionRule.create).not.toHaveBeenCalled();
  });

  it('admin recibe 400 con porcentaje inválido', async () => {
    const res = await request(appAs('admin')).put('/api/admin/commissions/rules').send({ tier: 'detal', porcentaje: 150 });
    expect(res.status).toBe(400);
  });
});

describe('hallazgos de revisión', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));
    db.commissionRule.findMany.mockResolvedValue([]);
    db.order.findMany.mockResolvedValue([]);
    db.commissionEntry.findMany.mockResolvedValue([]);
    db.commissionEntry.count.mockResolvedValue(0);
  });

  it('un reembolso de Mercado Pago (solo en el intento de pago) también revierte', async () => {
    await svc.syncCommissionEntries();
    const where = db.commissionEntry.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('paymentAttempts');
    expect(JSON.stringify(where)).toContain('refunded');
    expect(JSON.stringify(where)).toContain('charged_back');
  });

  it('se puede liquidar a quien ya no es comercial si tiene comisiones causadas', async () => {
    db.user.findUnique.mockResolvedValue({ id: 's1', role: 'cliente' });
    db.commissionEntry.count.mockResolvedValue(3);
    db.commissionEntry.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'e1', monto: D(100) }]);
    db.commissionAdjustment.findMany.mockResolvedValue([]);
    db.commissionLiquidation.create.mockImplementation(async ({ data }: any) => ({ id: 'L', ...data }));
    db.commissionEntry.updateMany.mockResolvedValue({ count: 1 });
    db.commissionAdjustment.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.createLiquidation({ sellerId: 's1', from: '2026-08-01', to: '2026-08-31', actorId: 'a' })).resolves.toBeTruthy();
  });

  it('rechaza fechas imposibles como 2026-02-30', () => {
    expect(() => svc.assertDay('2026-02-30', 'Fecha')).toThrow(svc.CommissionError);
    expect(svc.assertDay('2026-02-28', 'Fecha')).toBe('2026-02-28');
  });

  it('"hoy" se calcula en hora de Colombia', () => {
    expect(svc.todayInBogota(new Date('2026-11-30T03:00:00Z'))).toBe('2026-11-29');
  });

  it('el CSV deja numéricos los montos negativos y neutraliza solo el texto', () => {
    const csv = svc.liquidationToCsv({
      id: 'x', sellerName: 'Ana', periodFrom: '2026-08-01', periodTo: '2026-08-31', subtotal: 1, ajustes: -50000, total: 1,
      status: 'pending', createdAt: '', paidAt: null, entries: [],
      adjustments: [{ monto: -50000, motivo: '-cmd', createdAt: '' }],
    });
    expect(csv).toContain('-50000,');
    expect(csv).not.toContain("'-50000");
    expect(csv).toContain("'-cmd");
  });
});

describe('validación de ids en rutas', () => {
  it('ids que no son UUID devuelven 400 (no 500) y userId vacío no cambia la regla general', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = { id: 'u', email: 'a@b.co', role: 'admin', tier: 'detal' } as never; next(); });
    app.use('/c', router);
    app.use(errorHandler);
    await request(app).post('/c/liquidations').send({ sellerId: '', from: '2026-08-01', to: '2026-08-31' }).expect(400);
    await request(app).get('/c/liquidations/basura').expect(400);
    await request(app).put('/c/rules').send({ tier: 'detal', porcentaje: 5, userId: '' }).expect(400);
    expect(db.commissionRule.create).not.toHaveBeenCalled();
  });
});
