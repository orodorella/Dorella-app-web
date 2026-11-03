import express from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  expenseCategory: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), aggregate: vi.fn() },
  expense: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() },
  auditLog: { create: vi.fn() },
  $queryRaw: vi.fn(),
}));
vi.mock('../config/db.js', () => ({ prisma: db }));

const svc = await import('../services/expense.service.js');
const { default: router } = await import('../routes/admin/expenses.routes.js');
const { errorHandler } = await import('../middleware/errorHandler.js');

const D = (v: string | number) => new Prisma.Decimal(v);
const CAT = '11111111-1111-4111-8111-111111111111';
const valid = { fecha: '2026-11-05', descripcion: 'Taxi a bodega', valor: 25000, categoryId: CAT, proveedor: 'Taxi', medioPago: 'Efectivo' };

describe('categorías administrables', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea una categoría nueva sin tocar código y rechaza duplicados (sin distinguir mayúsculas)', async () => {
    db.expenseCategory.findFirst.mockResolvedValueOnce(null);
    db.expenseCategory.aggregate.mockResolvedValue({ _max: { orden: 9 } });
    db.expenseCategory.create.mockImplementation(async ({ data }: any) => ({ id: 'n', ...data }));
    const created = await svc.createCategory({ nombre: ' Capacitación ', afectaResultado: true, actorId: 'a' });
    expect(created.nombre).toBe('Capacitación');
    expect(created.orden).toBe(10);
    db.expenseCategory.findFirst.mockResolvedValueOnce({ id: 'x' });
    await expect(svc.createCategory({ nombre: 'capacitación', actorId: 'a' })).rejects.toMatchObject({ status: 409 });
  });

  it('una categoría que no afecta el resultado se puede marcar (anti doble conteo)', async () => {
    db.expenseCategory.findFirst.mockResolvedValue(null);
    db.expenseCategory.aggregate.mockResolvedValue({ _max: { orden: 1 } });
    db.expenseCategory.create.mockImplementation(async ({ data }: any) => ({ id: 'n', ...data }));
    const created = await svc.createCategory({ nombre: 'Flete de compra (capitalizado)', afectaResultado: false, actorId: 'a' });
    expect(created.afectaResultado).toBe(false);
  });
});

describe('registro de gastos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.expenseCategory.findUnique.mockResolvedValue({ id: CAT, nombre: 'Transporte y taxis', isActive: true, afectaResultado: true });
    db.expense.create.mockImplementation(async ({ data }: any) => ({ id: 'e1', ...data }));
  });

  it('registra el gasto con valor decimal exacto y auditoría', async () => {
    const created = await svc.createExpense(valid, 'admin-1');
    expect(created.valor.toString()).toBe('25000');
    expect(created.createdBy).toBe('admin-1');
    expect(db.auditLog.create).toHaveBeenCalled();
  });

  it('valida valor, fecha, descripción y categoría activa', async () => {
    for (const bad of [0, -5, 'abc', 10.123, undefined]) {
      await expect(svc.createExpense({ ...valid, valor: bad }, 'a')).rejects.toThrow();
    }
    await expect(svc.createExpense({ ...valid, fecha: '2026-02-30' }, 'a')).rejects.toThrow();
    await expect(svc.createExpense({ ...valid, descripcion: '  ' }, 'a')).rejects.toThrow();
    await expect(svc.createExpense({ ...valid, categoryId: 'no-uuid' }, 'a')).rejects.toThrow();
    db.expenseCategory.findUnique.mockResolvedValue({ id: CAT, isActive: false });
    await expect(svc.createExpense(valid, 'a')).rejects.toThrow(/inactiva/);
    expect(db.expense.create).not.toHaveBeenCalled();
  });

  it('anular exige motivo, es idempotente y no borra el registro', async () => {
    await expect(svc.voidExpense('e1', '', 'a')).rejects.toThrow();
    db.expense.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await svc.voidExpense('e1', 'duplicado', 'a')).toEqual({ id: 'e1', alreadyVoided: false });
    db.expense.updateMany.mockResolvedValueOnce({ count: 0 });
    db.expense.findUnique.mockResolvedValueOnce({ voidedAt: new Date() });
    expect(await svc.voidExpense('e1', 'duplicado', 'a')).toEqual({ id: 'e1', alreadyVoided: true });
    expect(db.expense.updateMany.mock.calls[0][0].where).toMatchObject({ voidedAt: null });
  });

  it('no permite editar un gasto anulado', async () => {
    db.expense.findUnique.mockResolvedValue({ id: 'e1', voidedAt: new Date(), valor: D(1), categoryId: CAT, fecha: new Date() });
    await expect(svc.updateExpense('e1', valid, 'a')).rejects.toMatchObject({ status: 409 });
  });
});

describe('edición de gastos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('permite editar un gasto cuya categoría ya está inactiva si no se cambia de categoría', async () => {
    db.expense.findUnique.mockResolvedValue({ id: 'e1', voidedAt: null, valor: D(1000), categoryId: CAT, fecha: new Date('2026-11-01T00:00:00Z') });
    db.expense.update.mockImplementation(async ({ data }: any) => ({ id: 'e1', ...data }));
    await expect(svc.updateExpense('e1', { ...valid, valor: 30000 }, 'a')).resolves.toBeTruthy();
    expect(db.expenseCategory.findUnique).not.toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalled();
  });

  it('exige categoría activa al cambiar de categoría', async () => {
    db.expense.findUnique.mockResolvedValue({ id: 'e1', voidedAt: null, valor: D(1000), categoryId: 'otra', fecha: new Date('2026-11-01T00:00:00Z') });
    db.expenseCategory.findUnique.mockResolvedValue({ id: CAT, isActive: false });
    await expect(svc.updateExpense('e1', valid, 'a')).rejects.toThrow(/inactiva/);
  });
});

describe('totales sin doble conteo', () => {
  it('el resultado operativo solo suma gastos vigentes de categorías que afectan el resultado', async () => {
    db.expense.aggregate.mockResolvedValue({ _sum: { valor: D(150000) } });
    const total = await svc.sumOperatingExpenses('2026-11-01', '2026-11-30');
    expect(total.toString()).toBe('150000');
    const where = db.expense.aggregate.mock.calls.at(-1)![0].where;
    expect(where).toMatchObject({ voidedAt: null, category: { afectaResultado: true } });
  });

  it('el resumen calcula participación y comparativo mensual', async () => {
    db.expense.groupBy.mockResolvedValue([
      { categoryId: 'c1', _sum: { valor: D(300000) }, _count: 3 },
      { categoryId: 'c2', _sum: { valor: D(100000) }, _count: 1 },
    ]);
    db.expenseCategory.findMany.mockResolvedValue([
      { id: 'c1', nombre: 'Vuelos', afectaResultado: true }, { id: 'c2', nombre: 'Servicios', afectaResultado: true },
    ]);
    db.$queryRaw.mockResolvedValue([{ month: '2026-10', total: '200000' }, { month: '2026-11', total: '400000' }]);
    const summary = await svc.getExpenseSummary('2026-11-01', '2026-11-30');
    expect(summary.total).toBe(400000);
    expect(summary.porCategoria[0]).toMatchObject({ categoria: 'Vuelos', participacionPct: 75 });
    expect(summary.comparativoMensual).toEqual({ mesActual: 400000, mesAnterior: 200000, variacionPct: 100 });
  });

  it('el CSV neutraliza fórmulas y marca anulados', async () => {
    db.expense.findMany.mockResolvedValue([{
      fecha: new Date('2026-11-05T00:00:00Z'), descripcion: '=cmd|calc', valor: D(1000), proveedor: null, medioPago: null,
      observaciones: null, soporteReferencia: null, voidedAt: new Date(), category: { nombre: 'Otros' },
    }]);
    const csv = await svc.expensesToCsv({ from: '2026-11-01', to: '2026-11-30' });
    expect(csv).toContain("'=cmd|calc");
    expect(csv).toContain('Anulado');
  });
});

describe('permisos de gastos', () => {
  function appAs(role: string) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: 'u1', email: 'a@b.co', role, tier: 'detal' } as never;
      next();
    });
    app.use('/api/admin/expenses', router);
    app.use(errorHandler);
    return app;
  }

  it('comercial, bodega y cliente no consultan ni registran gastos', async () => {
    for (const role of ['comercial', 'bodega', 'cliente']) {
      const app = appAs(role);
      await request(app).get('/api/admin/expenses').expect(403);
      await request(app).get('/api/admin/expenses/summary').expect(403);
      await request(app).get('/api/admin/expenses/export').expect(403);
      await request(app).post('/api/admin/expenses').send(valid).expect(403);
      await request(app).post('/api/admin/expenses/categories').send({ nombre: 'x' }).expect(403);
    }
    expect(db.expense.create).not.toHaveBeenCalled();
  });

  it('admin: payload inválido → 400', async () => {
    await request(appAs('admin')).post('/api/admin/expenses').send({ ...valid, valor: -1 }).expect(400);
    await request(appAs('admin')).put('/api/admin/expenses/basura').send(valid).expect(400);
  });
});
