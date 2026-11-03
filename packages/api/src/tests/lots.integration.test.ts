/**
 * Integración de lotes / FIFO contra un Postgres REAL y desechable (bloqueos, rollback, concurrencia e
 * idempotencia no se pueden probar con mocks). Se omite sin TEST_DATABASE_URL y se niega a correr si la
 * base no es local o si su nombre no contiene "test".
 *
 * IMPORTANTE: usa las migraciones reales (no `db push`) para que existan los CHECK y los índices parciales:
 *
 *   DATABASE_URL=postgresql://USER:PASS@localhost:PUERTO/dorella_test DIRECT_URL=<igual> npx prisma migrate deploy
 *   TEST_DATABASE_URL=postgresql://USER:PASS@localhost:PUERTO/dorella_test npx vitest run src/tests/lots.integration.test.ts
 *
 * ESTADO: ejecutada el 2026-11-02 contra un PostgreSQL 16 desechable en Docker (todas pasan, 3 corridas seguidas).
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  const url = new URL(TEST_DATABASE_URL);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('TEST_DATABASE_URL debe apuntar a una BD local desechable');
  if (!/test/i.test(url.pathname)) throw new Error('El nombre de la base de pruebas debe contener "test"');
}

describe.skipIf(!TEST_DATABASE_URL)('lotes, FIFO e inventario contra Postgres real', () => {
  let prisma: PrismaClient;
  let lots: typeof import('../services/lot.service.js');
  let orders: typeof import('../services/order.service.js');
  let categoryId: string;
  let adminId: string;
  const runTag = randomUUID().slice(0, 8);

  const comprador = { nombre: 'Prueba', apellido: 'Integración', telefono: '3001234567', ciudad: 'Cali', direccion: 'Calle 1', informacionEntrega: '', correo: null };

  async function newProduct(stock = 0) {
    return prisma.product.create({
      data: { sku: `LOT-${runTag}-${randomUUID().slice(0, 8)}`, nombre: 'Producto lotes', precioBase: 100_000, categoryId, stock },
      select: { id: true },
    });
  }
  const purchase = (productId: string, cantidad: number, costoUnitario: number, extra: Record<string, unknown> = {}) =>
    lots.registerPurchase({ productId, cantidad, costoUnitario, fechaCompra: '2026-11-01', actorId: adminId, ...extra });
  const stockOf = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id }, select: { stock: true, stockReservado: true } }));
  const lotsOf = (productId: string) => prisma.inventoryLot.findMany({ where: { productId }, orderBy: [{ fechaCompra: 'asc' }, { createdAt: 'asc' }] });

  async function sellAndPay(productId: string, cantidad: number) {
    const order = await orders.createManualOrder(adminId, { comprador, items: [{ productId, cantidad, descuentoAdicional: 0 }], notas: '' }, 'admin');
    const paid = await orders.markOrderPaidManually(order.id, adminId);
    expect(paid.outcome).toBe('paid');
    return order;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    ({ prisma } = await import('../config/db.js'));
    lots = await import('../services/lot.service.js');
    orders = await import('../services/order.service.js');
    categoryId = (await prisma.category.create({ data: { nombre: 'Lotes', slug: `lotes-${runTag}` } })).id;
    adminId = (await prisma.user.create({ data: { email: `lotes-${runTag}@test.local`, nombre: 'Admin', apellido: 'Test', passwordHash: 'x', role: 'admin' }, select: { id: true } })).id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('una compra suma stock una sola vez y conserva su costo; la misma clave de idempotencia no repite nada', async () => {
    const p = await newProduct(0);
    const key = `k-${randomUUID()}`;
    const first = await purchase(p.id, 10, 50_000, { gastosAdicionales: 20_000, idempotencyKey: key });
    const second = await purchase(p.id, 10, 50_000, { gastosAdicionales: 20_000, idempotencyKey: key });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect((await stockOf(p.id)).stock).toBe(10);
    const [lot] = await lotsOf(p.id);
    expect(Number(lot.costoUnitarioEfectivo)).toBe(52_000);
    expect(await prisma.inventoryMovement.count({ where: { productId: p.id, tipo: 'compra' } })).toBe(1);
  });

  it('8 envíos simultáneos con la misma clave crean un solo lote y suman el stock una vez', async () => {
    const p = await newProduct(0);
    const key = `k-${randomUUID()}`;
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => purchase(p.id, 5, 10_000, { idempotencyKey: key })));
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(await prisma.inventoryLot.count({ where: { productId: p.id } })).toBe(1);
    expect((await stockOf(p.id)).stock).toBe(5);
  });

  it('FIFO con varios lotes: la venta consume del más antiguo al más nuevo y congela el costo exacto', async () => {
    const p = await newProduct(0);
    await purchase(p.id, 4, 50_000, { fechaCompra: '2026-10-01' });
    await purchase(p.id, 10, 60_000, { fechaCompra: '2026-10-15' });
    const order = await sellAndPay(p.id, 7);
    await lots.syncFifoCosts();
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(Number(item.costoTotalSnapshot)).toBe(4 * 50_000 + 3 * 60_000);
    expect(item.costoMetodo).toBe('fifo');
    const [a, b] = await lotsOf(p.id);
    expect([a.cantidadRestante, b.cantidadRestante]).toEqual([0, 7]);
    // el stock físico bajó UNA vez por el pago (14 comprado − 7 vendido) y el costeo no lo vuelve a tocar
    expect((await stockOf(p.id)).stock).toBe(7);
  });

  it('varias sincronizaciones simultáneas no consumen el lote dos veces', async () => {
    const p = await newProduct(0);
    await purchase(p.id, 10, 1_000);
    const order = await sellAndPay(p.id, 6);
    await Promise.all(Array.from({ length: 6 }, () => lots.syncFifoCosts()));
    const [lot] = await lotsOf(p.id);
    expect(lot.cantidadRestante).toBe(4);
    expect(await prisma.lotConsumption.count({ where: { orderItem: { orderId: order.id }, reversedAt: null } })).toBe(1);
    expect((await stockOf(p.id)).stock).toBe(4);
  });

  it('cancelar la orden restituye lotes y stock una sola vez, aunque se sincronice varias veces', async () => {
    const p = await newProduct(0);
    await purchase(p.id, 10, 1_000);
    const order = await sellAndPay(p.id, 3);
    await lots.syncFifoCosts();
    await orders.updateOrderStatus(order.id, 'cancelled');
    await Promise.all([lots.syncFifoCosts(), lots.syncFifoCosts(), lots.syncFifoCosts()]);
    const [lot] = await lotsOf(p.id);
    expect(lot.cantidadRestante).toBe(10);
    expect((await stockOf(p.id)).stock).toBe(10);
    expect(await prisma.inventoryMovement.count({ where: { productId: p.id, tipo: 'devolucion' } })).toBe(1);
  });

  it('compras y ventas concurrentes: 6 pedidos pagados a la vez sobre 2 lotes consumen exactamente lo vendido, sin doble descuento', async () => {
    const p = await newProduct(0);
    await purchase(p.id, 10, 1_000, { fechaCompra: '2026-10-01' });
    await purchase(p.id, 20, 2_000, { fechaCompra: '2026-10-10' });
    const [, , ...orders6] = await Promise.all([
      purchase(p.id, 5, 3_000, { fechaCompra: '2026-10-20' }), // compra simultánea a las ventas
      Promise.resolve(),
      ...Array.from({ length: 6 }, () => sellAndPay(p.id, 4)),
    ]);
    await Promise.all([lots.syncFifoCosts(), lots.syncFifoCosts()]);
    // 35 comprados − 24 vendidos = 11 en stock físico y 11 en lotes
    expect((await stockOf(p.id)).stock).toBe(11);
    const restantes = (await lotsOf(p.id)).reduce((sum, l) => sum + l.cantidadRestante, 0);
    expect(restantes).toBe(11);
    // cada línea quedó costeada una sola vez
    for (const order of orders6 as Array<{ id: string }>) {
      expect(await prisma.lotConsumption.count({ where: { orderItem: { orderId: order.id }, reversedAt: null } })).toBeGreaterThan(0);
      const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
      expect(item.costoMetodo).toBe('fifo');
    }
    const consumido = await prisma.lotConsumption.aggregate({ where: { reversedAt: null, orderItem: { productId: p.id } }, _sum: { cantidad: true } });
    expect(consumido._sum.cantidad).toBe(24);
  });

  it('marcar pagado dos veces no descuenta stock ni lotes dos veces', async () => {
    const p = await newProduct(0);
    await purchase(p.id, 10, 1_000);
    const order = await orders.createManualOrder(adminId, { comprador, items: [{ productId: p.id, cantidad: 3, descuentoAdicional: 0 }], notas: '' }, 'admin');
    const [a, b] = await Promise.all([orders.markOrderPaidManually(order.id, adminId), orders.markOrderPaidManually(order.id, adminId)]);
    expect([a.outcome, b.outcome].sort()).toEqual(['already_paid', 'paid']);
    await lots.syncFifoCosts();
    expect((await stockOf(p.id)).stock).toBe(7);
    expect((await lotsOf(p.id))[0].cantidadRestante).toBe(7);
  });

  it('sin lotes suficientes la línea queda sin_lote y el stock/lotes no se tocan', async () => {
    const p = await newProduct(5); // 5 unidades existentes sin costo
    await purchase(p.id, 2, 1_000);
    const order = await sellAndPay(p.id, 4);
    await lots.syncFifoCosts();
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(item.costoMetodo).toBe('sin_lote');
    expect(item.costoTotalSnapshot).toBeNull();
    const [lot] = await lotsOf(p.id);
    expect(lot.cantidadRestante).toBe(2);
  });

  it('la valoración inicial no suma stock y no puede exceder lo no valorado', async () => {
    const p = await newProduct(8);
    await purchase(p.id, 8, 2_000, { tipo: 'valoracion_inicial' });
    expect((await stockOf(p.id)).stock).toBe(8);
    await expect(purchase(p.id, 1, 2_000, { tipo: 'valoracion_inicial' })).rejects.toMatchObject({ code: 'UNITS_EXCEED_UNVALUED' });
  });

  it('el CHECK de la base impide cantidad_restante mayor a la comprada (requiere migraciones reales)', async () => {
    const p = await newProduct(0);
    const { lot } = await purchase(p.id, 3, 1_000);
    await expect(prisma.inventoryLot.update({ where: { id: lot.id }, data: { cantidadRestante: 4 } })).rejects.toThrow();
  });
});
