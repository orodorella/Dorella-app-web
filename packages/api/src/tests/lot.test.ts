import express from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const P = '11111111-1111-4111-8111-111111111111';
const D = (v: string | number) => new Prisma.Decimal(v);

const db = vi.hoisted(() => {
  const mock: Record<string, any> = {
    order: { findMany: vi.fn(), count: vi.fn() },
    orderItem: { update: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
    lotConsumption: { count: vi.fn(), create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), aggregate: vi.fn() },
    inventoryLot: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), aggregate: vi.fn() },
    inventoryMovement: { create: vi.fn() },
    product: { update: vi.fn() },
    auditLog: { create: vi.fn() },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(async () => 1),
  };
  mock.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(mock));
  return mock;
});
const stock = vi.hoisted(() => ({ applyInventoryDeltas: vi.fn(async () => true) }));
vi.mock('../config/db.js', () => ({ prisma: db }));
vi.mock('../services/inventory-stock.js', () => stock);
vi.mock('../services/commission.service.js', async (importActual) => ({
  ...(await importActual<typeof import('../services/commission.service.js')>()),
  // La causación de comisiones tiene sus propias pruebas (commission.test.ts); aquí solo importa que el trabajador la invoque.
  syncCommissionEntries: vi.fn(async () => ({ accrued: 0, voided: 0, clawbacks: 0 })),
}));

const svc = await import('../services/lot.service.js');
const { default: router } = await import('../routes/admin/finance.routes.js');
const { errorHandler } = await import('../middleware/errorHandler.js');

const base = { productId: P, cantidad: 10, costoUnitario: 50000, fechaCompra: '2026-11-01', actorId: 'a' };

describe('costos de lote', () => {
  it('el costo efectivo suma los gastos de adquisición prorrateados', () => {
    expect(svc.effectiveUnitCost(50000, 20000, 10).toString()).toBe('52000');
    expect(svc.effectiveUnitCost(10000, 1, 3).toString()).toBe('10000.3333');
    expect(svc.consumptionCost(3, '10000.3333').toString()).toBe('30001');
  });
});

describe('plan FIFO', () => {
  const lotes = [
    { id: 'L1', restante: 4, costo: D(50000) },
    { id: 'L2', restante: 10, costo: D(60000) },
    { id: 'L3', restante: 5, costo: D(70000) },
  ];

  it('varias compras con costos distintos: una venta consume del lote más antiguo al más nuevo', () => {
    const plan = svc.planFifo(lotes, 7)!;
    expect(plan.map((t) => [t.lotId, t.cantidad])).toEqual([['L1', 4], ['L2', 3]]);
    const total = plan.reduce((s, t) => s.add(t.costoTotal), D(0));
    expect(total.toString()).toBe(String(4 * 50000 + 3 * 60000));
  });

  it('un lote agotado se salta y es todo-o-nada si no alcanza', () => {
    expect(svc.planFifo([{ id: 'X', restante: 0, costo: D(1) }, ...lotes], 2)![0].lotId).toBe('L1');
    expect(svc.planFifo(lotes, 20)).toBeNull();
    expect(svc.planFifo(lotes, 19)).not.toBeNull();
  });
});

describe('registro de compras', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));
    db.$queryRaw.mockResolvedValue([{ id: P, stock: 10 }]);
    db.inventoryLot.findUnique.mockResolvedValue(null);
    db.inventoryLot.create.mockImplementation(async ({ data }: any) => ({ id: 'lot-1', ...data, referencia: null }));
    stock.applyInventoryDeltas.mockResolvedValue(true);
  });

  it('una compra crea el lote con su costo histórico, suma el stock UNA vez y deja movimiento y auditoría', async () => {
    const { lot, duplicate } = await svc.registerPurchase({ ...base, gastosAdicionales: 20000, proveedor: 'Proveedor SAS', referencia: 'FV-123' });
    expect(duplicate).toBe(false);
    expect(lot.costoUnitarioEfectivo.toString()).toBe('52000');
    expect(lot.cantidadRestante).toBe(10);
    expect(stock.applyInventoryDeltas).toHaveBeenCalledOnce();
    expect(stock.applyInventoryDeltas).toHaveBeenCalledWith(db, [{ productId: P, stock: 10 }]);
    expect(db.inventoryMovement.create.mock.calls[0][0].data).toMatchObject({ tipo: 'compra', cantidad: 10 });
    expect(db.auditLog.create).toHaveBeenCalled();
  });

  it('es idempotente: la misma clave no vuelve a sumar stock ni crea otro lote', async () => {
    db.inventoryLot.findUnique.mockResolvedValue({ id: 'lot-1', cantidad: 10 });
    const result = await svc.registerPurchase({ ...base, idempotencyKey: 'form-abc' });
    expect(result.duplicate).toBe(true);
    expect(stock.applyInventoryDeltas).not.toHaveBeenCalled();
    expect(db.inventoryLot.create).not.toHaveBeenCalled();
  });

  it('dos envíos simultáneos con la misma clave: el perdedor recibe el lote del ganador', async () => {
    db.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
    db.inventoryLot.findUnique.mockResolvedValue({ id: 'lot-ganador' });
    const result = await svc.registerPurchase({ ...base, idempotencyKey: 'form-abc' });
    expect(result).toMatchObject({ duplicate: true, lot: { id: 'lot-ganador' } });
  });

  it('la valoración inicial NO suma stock y no puede exceder las unidades sin valorar', async () => {
    db.inventoryLot.aggregate.mockResolvedValue({ _sum: { cantidadRestante: 4 } });
    await svc.registerPurchase({ ...base, tipo: 'valoracion_inicial', cantidad: 6 });
    expect(stock.applyInventoryDeltas).not.toHaveBeenCalled();
    db.inventoryLot.aggregate.mockResolvedValue({ _sum: { cantidadRestante: 5 } });
    await expect(svc.registerPurchase({ ...base, tipo: 'valoracion_inicial', cantidad: 6 })).rejects.toMatchObject({ code: 'UNITS_EXCEED_UNVALUED' });
  });

  it('valida cantidad, costos, fecha y producto', async () => {
    for (const cantidad of [0, -1, 1.5, 'x', 2_000_000]) {
      await expect(svc.registerPurchase({ ...base, cantidad })).rejects.toThrow();
    }
    for (const costoUnitario of [-1, 'abc', 1.234, undefined]) {
      await expect(svc.registerPurchase({ ...base, costoUnitario })).rejects.toThrow();
    }
    await expect(svc.registerPurchase({ ...base, gastosAdicionales: -5 })).rejects.toThrow();
    await expect(svc.registerPurchase({ ...base, fechaCompra: '2999-01-01' })).rejects.toThrow();
    await expect(svc.registerPurchase({ ...base, productId: 'no-uuid' })).rejects.toThrow();
    db.$queryRaw.mockResolvedValue([]);
    await expect(svc.registerPurchase(base)).rejects.toMatchObject({ status: 404 });
  });

  it('si el sistema de inventario rechaza el aumento de stock, la compra no se registra', async () => {
    stock.applyInventoryDeltas.mockResolvedValue(false);
    await expect(svc.registerPurchase(base)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(db.inventoryLot.create).not.toHaveBeenCalled();
  });
});

describe('costeo FIFO de órdenes', () => {
  const orderPaid = (items: Array<{ id: string; cantidad: number; sku?: string }>) => ({
    id: 'o1', paidAt: new Date('2026-11-05T12:00:00Z'), updatedAt: new Date(),
    items: items.map((i) => ({ id: i.id, productId: P, cantidad: i.cantidad, sku: i.sku ?? 'SKU' })),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));
    db.lotConsumption.count.mockResolvedValue(0);
    db.orderItem.findUnique.mockResolvedValue({ costoMetodo: null });
    db.inventoryLot.updateMany.mockResolvedValue({ count: 1 });
    db.$executeRaw.mockResolvedValue(1);
  });

  it('una venta que consume dos lotes guarda el desglose, el costo exacto y el método', async () => {
    db.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([orderPaid([{ id: 'i1', cantidad: 7 }])]);
    db.$queryRaw.mockResolvedValue([{ id: 'L1', restante: 4, costo: '50000' }, { id: 'L2', restante: 10, costo: '60000' }]);
    const result = await svc.syncFifoCosts();
    expect(result.costed).toBe(1);
    const consumos = db.lotConsumption.create.mock.calls.map((c: any) => [c[0].data.lotId, c[0].data.cantidad]);
    expect(consumos).toEqual([['L1', 4], ['L2', 3]]);
    const update = db.orderItem.update.mock.calls[0][0].data;
    expect(update.costoTotalSnapshot.toString()).toBe('380000');
    expect(update.costoUnitarioSnapshot.toString()).toBe('54285.71');
    expect(update.costoMetodo).toBe('fifo');
    expect(db.inventoryMovement.create).toHaveBeenCalledTimes(2);
  });

  it('solo usa lotes que ya existían al momento del pago (no costea hacia atrás con valoraciones nuevas)', async () => {
    db.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([orderPaid([{ id: 'i1', cantidad: 1 }])]);
    db.$queryRaw.mockResolvedValue([]);
    await svc.syncFifoCosts();
    const valores = (db.$queryRaw.mock.calls[0] as unknown[]).slice(1);
    expect(valores.some((v) => v instanceof Date && v.toISOString() === '2026-11-05T12:00:00.000Z')).toBe(true);
    const sql = (db.$queryRaw.mock.calls[0][0] as string[]).join(' ');
    expect(sql).toContain('created_at <=');
    expect(sql).toContain('FOR UPDATE');
  });

  it('sin lotes suficientes la línea queda sin_lote: no consume nada ni inventa costo cero', async () => {
    db.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([orderPaid([{ id: 'i1', cantidad: 5 }])]);
    db.$queryRaw.mockResolvedValue([{ id: 'L1', restante: 2, costo: '50000' }]);
    const result = await svc.syncFifoCosts();
    expect(result).toMatchObject({ costed: 0, unCovered: 1 });
    expect(db.lotConsumption.create).not.toHaveBeenCalled();
    expect(db.inventoryLot.updateMany).not.toHaveBeenCalled();
    expect(db.orderItem.update.mock.calls[0][0].data).toEqual({ costoMetodo: 'sin_lote' });
  });

  it('es idempotente: una línea con consumo activo no se vuelve a costear (sin doble descuento)', async () => {
    db.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([orderPaid([{ id: 'i1', cantidad: 3 }])]);
    db.lotConsumption.count.mockResolvedValue(1);
    await svc.syncFifoCosts();
    expect(db.inventoryLot.updateMany).not.toHaveBeenCalled();
    expect(db.lotConsumption.create).not.toHaveBeenCalled();
  });

  it('una carrera por el lote (otra transacción lo consumió) revierte la orden en lugar de dejar saldos negativos', async () => {
    db.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([orderPaid([{ id: 'i1', cantidad: 3 }])]);
    db.$queryRaw.mockResolvedValue([{ id: 'L1', restante: 10, costo: '1000' }]);
    db.inventoryLot.updateMany.mockResolvedValue({ count: 0 });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await svc.syncFifoCosts();
    spy.mockRestore();
    // La transacción se revierte (nada queda a medias) y la sincronización sigue con las demás órdenes.
    expect(result).toMatchObject({ costed: 0, failed: 1 });
    expect(db.lotConsumption.create).not.toHaveBeenCalled();
  });

  it('serializa con un bloqueo consultivo global y re-comprueba dentro del bloqueo (otra sync ya costeó)', async () => {
    db.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([orderPaid([{ id: 'i1', cantidad: 3 }])]);
    db.orderItem.findUnique.mockResolvedValue({ costoMetodo: 'fifo' }); // otra sync la dejó costeada mientras esperábamos
    await svc.syncFifoCosts();
    const sqls = db.$executeRaw.mock.calls.map((c: any[]) => (c[0] as string[]).join(' '));
    expect(sqls.some((q: string) => q.includes('pg_advisory_xact_lock'))).toBe(true);
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(db.inventoryLot.updateMany).not.toHaveBeenCalled();
    expect(db.lotConsumption.create).not.toHaveBeenCalled();
  });

  it('una orden que falla no impide costear las demás ni hace fallar la sincronización', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const buena = { ...orderPaid([{ id: 'i2', cantidad: 1 }]), id: 'o2' };
    db.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([orderPaid([{ id: 'i1', cantidad: 1 }]), buena]);
    db.$queryRaw.mockRejectedValueOnce(new Error('timeout de transacción')).mockResolvedValueOnce([{ id: 'L1', restante: 5, costo: '1000' }]);
    const result = await svc.syncFifoCosts();
    expect(result).toMatchObject({ costed: 1, failed: 1 });
    spy.mockRestore();
  });

  it('solo restituye lotes de órdenes canceladas (donde el stock también se restituye), no de reembolsos sueltos', async () => {
    db.order.findMany.mockResolvedValue([]);
    await svc.syncFifoCosts();
    const where = db.order.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('cancelled');
    expect(JSON.stringify(where)).not.toContain('refunded');
  });

  it('ignora las líneas de cursos (ACD-)', async () => {
    db.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([orderPaid([{ id: 'i1', cantidad: 1, sku: 'ACD-curso' }])]);
    await svc.syncFifoCosts();
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it('cancelar una orden costeada restituye los lotes una sola vez y registra la devolución', async () => {
    db.order.findMany.mockResolvedValueOnce([{ id: 'o1' }]).mockResolvedValueOnce([]);
    db.lotConsumption.findMany.mockResolvedValue([{ id: 'c1', lotId: 'L1', cantidad: 4, costoUnitario: D(50000), orderItemId: 'i1', orderItem: { productId: P } }]);
    db.lotConsumption.updateMany.mockResolvedValue({ count: 1 });
    const first = await svc.syncFifoCosts();
    expect(first.restored).toBe(1);
    const sql = (db.$executeRaw.mock.calls.find((c: any[]) => (c[0] as string[]).join(' ').includes('LEAST'))![0] as string[]).join(' ');
    expect(sql).toContain('LEAST(cantidad, cantidad_restante +');
    expect(db.inventoryMovement.create.mock.calls[0][0].data).toMatchObject({ tipo: 'devolucion', cantidad: 4 });
    expect(db.lotConsumption.updateMany.mock.calls[0][0].where).toMatchObject({ reversedAt: null });

    // segunda ejecución concurrente: la restitución ya fue marcada → no suma de nuevo
    db.$executeRaw.mockClear();
    db.order.findMany.mockResolvedValueOnce([{ id: 'o1' }]).mockResolvedValueOnce([]);
    db.lotConsumption.updateMany.mockResolvedValue({ count: 0 });
    const second = await svc.syncFifoCosts();
    expect(second.restored).toBe(0);
    expect(db.$executeRaw.mock.calls.some((c: any[]) => (c[0] as string[]).join(' ').includes('LEAST'))).toBe(false);
  });
});

describe('ajustes de lote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));
    db.lotConsumption.aggregate.mockResolvedValue({ _sum: { cantidad: null } });
  });

  it('ajusta la cantidad restante con motivo, deja movimiento negativo y auditoría', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'L1', product_id: P, cantidad: 10, restante: 8, costo: '50000' }]);
    await svc.adjustLot('L1', { cantidadRestante: 5, motivo: 'Merma', actorId: 'a' });
    expect(db.inventoryMovement.create.mock.calls[0][0].data).toMatchObject({ tipo: 'ajuste', cantidad: -3, motivo: 'Merma' });
    expect(db.auditLog.create).toHaveBeenCalled();
  });

  it('no permite subir el restante por encima de lo que dejan las órdenes activas (protege la restitución)', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'L1', product_id: P, cantidad: 10, restante: 6, costo: '1' }]);
    db.lotConsumption.aggregate.mockResolvedValue({ _sum: { cantidad: 4 } });
    await expect(svc.adjustLot('L1', { cantidadRestante: 10, motivo: 'corrección', actorId: 'a' })).rejects.toMatchObject({ status: 409 });
    await expect(svc.adjustLot('L1', { cantidadRestante: 6, motivo: 'corrección', actorId: 'a' })).resolves.toMatchObject({ sinCambios: true });
  });

  it('rechaza superar lo comprado, valores inválidos y falta de motivo', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'L1', product_id: P, cantidad: 10, restante: 8, costo: '1' }]);
    await expect(svc.adjustLot('L1', { cantidadRestante: 11, motivo: 'x y z', actorId: 'a' })).rejects.toThrow();
    await expect(svc.adjustLot('L1', { cantidadRestante: -1, motivo: 'abc', actorId: 'a' })).rejects.toThrow();
    await expect(svc.adjustLot('L1', { cantidadRestante: 2, motivo: '', actorId: 'a' })).rejects.toThrow();
  });
});

describe('valoración e indicadores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.order.findMany.mockResolvedValue([]);
  });

  it('suma inventario valorizado, costo promedio informativo, compras del periodo y unidades sin valorar', async () => {
    db.$queryRaw
      .mockResolvedValueOnce([
        { id: 'p1', sku: 'A', nombre: 'Anillo', stock: 20, valoradas: 14, valor: '780000', lotes: 2 },
        { id: 'p2', sku: 'B', nombre: 'Cadena', stock: 5, valoradas: 5, valor: '250000', lotes: 1 },
      ])
      .mockResolvedValueOnce([{ total: '1500000', unidades: '25', lotes: 2 }]);
    const v = await svc.getInventoryValuation('2026-11-01', '2026-11-30');
    expect(v.resumen).toMatchObject({
      comprasPeriodo: 1_500_000, inventarioValorizado: 1_030_000, unidadesValoradas: 19, unidadesSinValorar: 6,
      costoPromedioUnitario: 54210.53, lotesPeriodo: 2,
    });
    expect(v.productos[0]).toMatchObject({ sku: 'A', unidadesSinValorar: 6, costoPromedio: 55714.29 });
    expect(v.notas.join(' ')).toMatch(/NO se valoran/);
  });

  it('marca productos cuya valoración excede el stock físico (inconsistencia visible)', async () => {
    db.$queryRaw
      .mockResolvedValueOnce([{ id: 'p1', sku: 'A', nombre: 'Anillo', stock: 3, valoradas: 5, valor: '100', lotes: 1 }])
      .mockResolvedValueOnce([{ total: '0', unidades: '0', lotes: 0 }]);
    const v = await svc.getInventoryValuation('2026-11-01', '2026-11-30');
    expect(v.resumen.productosConValoracionMayorAlStock).toBe(1);
    expect(v.resumen.unidadesSinValorar).toBe(0);
  });
});

describe('costeo automático (trabajador)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.__resetCostingWorkerForTests();
    db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));
    db.lotConsumption.count.mockResolvedValue(0);
    db.orderItem.findUnique.mockResolvedValue({ costoMetodo: null });
    db.inventoryLot.updateMany.mockResolvedValue({ count: 1 });
    db.$executeRaw.mockResolvedValue(1);
  });

  it('una ronda costea los pagos pendientes sin que nadie abra un reporte', async () => {
    db.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'o1', paidAt: new Date(), updatedAt: new Date(), items: [{ id: 'i1', productId: P, cantidad: 2, sku: 'A' }] }]);
    db.$queryRaw.mockResolvedValue([{ id: 'L1', restante: 5, costo: '1000' }]);
    await svc.runCostingTick();
    expect(db.lotConsumption.create).toHaveBeenCalledOnce();
    db.order.count.mockResolvedValue(0);
    db.orderItem.count.mockResolvedValue(0);
    const status = await svc.getCostingStatus();
    expect(status.lastResult).toMatchObject({ costed: 1, failed: 0 });
    expect(status.consecutiveFailures).toBe(0);
  });

  it('nunca lanza: ante un fallo registra el error y reintenta más tarde con retroceso', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    db.order.findMany.mockRejectedValue(new Error('conexión caída'));
    await expect(svc.runCostingTick()).resolves.toBeUndefined();
    db.order.count.mockResolvedValue(3);
    db.orderItem.count.mockResolvedValue(1);
    const status = await svc.getCostingStatus();
    expect(status).toMatchObject({ lastError: 'conexión caída', consecutiveFailures: 1, pendientes: { ordenesPorCostear: 3, lineasSinLote: 1 } });
    // retroceso: la siguiente ronda se omite
    db.order.findMany.mockClear();
    await svc.runCostingTick();
    expect(db.order.findMany).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('la ronda también causa comisiones (ya no depende de abrir el resumen) y un fallo ahí cuenta como fallo', async () => {
    const commission = await import('../services/commission.service.js');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    db.order.findMany.mockResolvedValue([]);
    await svc.runCostingTick();
    expect(commission.syncCommissionEntries).toHaveBeenCalled();
    (commission.syncCommissionEntries as unknown as { mockRejectedValueOnce: (e: unknown) => void }).mockRejectedValueOnce(new Error('boom'));
    svc.__resetCostingWorkerForTests();
    await svc.runCostingTick();
    db.order.count.mockResolvedValue(0);
    db.orderItem.count.mockResolvedValue(0);
    expect((await svc.getCostingStatus()).consecutiveFailures).toBe(1);
    spy.mockRestore();
  });

  it('marca como sin_lote en UNA sola sentencia las líneas que no pueden tener lote (histórico anterior a la función)', async () => {
    db.order.findMany.mockResolvedValue([]);
    await svc.syncFifoCosts();
    const sqls = db.$executeRaw.mock.calls.map((c: any[]) => (c[0] as string[]).join(' '));
    const bulk = sqls.find((q: string) => q.includes("SET costo_metodo = 'sin_lote'"));
    expect(bulk).toBeDefined();
    expect(bulk).toContain('NOT EXISTS');
    expect(bulk).toContain('l.created_at <=');
  });

  it('los fallos por orden no se ocultan: el estado informa cuántas órdenes fallaron', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    db.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'o1', paidAt: new Date(), updatedAt: new Date(), items: [{ id: 'i1', productId: P, cantidad: 1, sku: 'A' }] }]);
    db.$queryRaw.mockRejectedValueOnce(new Error('timeout'));
    await svc.runCostingTick();
    db.order.count.mockResolvedValue(1);
    db.orderItem.count.mockResolvedValue(0);
    const status = await svc.getCostingStatus();
    expect(status.lastError).toMatch(/1 orden/);
    expect(status.consecutiveFailures).toBe(1);
    spy.mockRestore();
  });

  it('se recupera solo: tras el retroceso, una ronda exitosa reinicia el contador de fallos', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    db.order.findMany.mockRejectedValueOnce(new Error('temporal'));
    await svc.runCostingTick();
    await svc.runCostingTick(); // omitida por retroceso
    db.order.findMany.mockResolvedValue([]);
    await svc.runCostingTick();
    await svc.runCostingTick();
    db.order.count.mockResolvedValue(0);
    db.orderItem.count.mockResolvedValue(0);
    expect((await svc.getCostingStatus()).consecutiveFailures).toBe(0);
    spy.mockRestore();
  });

  it('dos rondas simultáneas en el mismo proceso no se pisan', async () => {
    let release: () => void = () => undefined;
    db.order.findMany.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve([]); }));
    db.order.findMany.mockResolvedValue([]);
    const primera = svc.runCostingTick();
    await svc.runCostingTick(); // se omite: ya hay una en curso
    expect(db.order.findMany).toHaveBeenCalledTimes(1);
    release();
    await primera;
  });

  it('el estado de costeo es solo para el administrador', async () => {
    const express = (await import('express')).default;
    const app = express();
    app.use((req, _res, next) => { req.user = { id: 'u', email: 'a@b.co', role: 'bodega', tier: 'detal' } as never; next(); });
    app.use('/api/admin/finance', router);
    app.use(errorHandler);
    await request(app).get('/api/admin/finance/inventory/costing-status').expect(403);
  });
});

describe('ajuste manual de stock (fuente de verdad física)', () => {
  const inventory = () => import('../services/inventory.service.js');
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));
    db.product.update.mockImplementation(async ({ data }: any) => ({ id: P, stock: data.stock }));
  });

  it('bloquea la fila, registra movimiento y auditoría con el valor anterior', async () => {
    db.$queryRaw.mockResolvedValue([{ id: P, stock: 10, reservado: 2 }]);
    const { adjustStock } = await inventory();
    await adjustStock(P, 15, 'admin-1');
    const sql = (db.$queryRaw.mock.calls[0][0] as string[]).join(' ');
    expect(sql).toContain('FOR UPDATE');
    expect(db.inventoryMovement.create.mock.calls[0][0].data).toMatchObject({ tipo: 'ajuste', cantidad: 5, createdBy: 'admin-1' });
    expect(db.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: 'product.stock_adjusted', before: { stock: 10 }, after: { stock: 15 } });
  });

  it('no permite dejar el stock por debajo de lo reservado y no escribe nada', async () => {
    db.$queryRaw.mockResolvedValue([{ id: P, stock: 10, reservado: 4 }]);
    const { adjustStock } = await inventory();
    await expect(adjustStock(P, 3, 'a')).rejects.toMatchObject({ code: 'STOCK_BELOW_RESERVED' });
    expect(db.product.update).not.toHaveBeenCalled();
    expect(db.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('sin cambio de valor no genera movimiento y un producto inexistente devuelve null', async () => {
    db.$queryRaw.mockResolvedValue([{ id: P, stock: 10, reservado: 0 }]);
    const { adjustStock } = await inventory();
    await adjustStock(P, 10, 'a');
    expect(db.inventoryMovement.create).not.toHaveBeenCalled();
    db.$queryRaw.mockResolvedValue([]);
    expect(await adjustStock(P, 5, 'a')).toBeNull();
  });
});

describe('protección por rol de las rutas de inventario con costo', () => {
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

  it('comercial, bodega y cliente no ven ni registran compras, lotes, ajustes ni valoración', async () => {
    for (const role of ['comercial', 'bodega', 'cliente']) {
      const app = appAs(role);
      await request(app).post('/api/admin/finance/inventory/purchases').send(base).expect(403);
      await request(app).get('/api/admin/finance/inventory/valuation').expect(403);
      await request(app).get(`/api/admin/finance/inventory/products/${P}/history`).expect(403);
      await request(app).post(`/api/admin/finance/inventory/lots/${P}/adjust`).send({}).expect(403);
    }
    expect(db.inventoryLot.create).not.toHaveBeenCalled();
    expect(stock.applyInventoryDeltas).not.toHaveBeenCalled();
  });

  it('admin: datos inválidos devuelven 400, no 500', async () => {
    const app = appAs('admin');
    await request(app).post('/api/admin/finance/inventory/purchases').send({ ...base, cantidad: -3 }).expect(400);
    await request(app).post('/api/admin/finance/inventory/lots/no-uuid/adjust').send({}).expect(400);
    await request(app).get('/api/admin/finance/inventory/valuation?from=2026-02-30&to=2026-03-01').expect(400);
  });
});
