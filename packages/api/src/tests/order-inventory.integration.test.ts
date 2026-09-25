/**
 * Integración contra un Postgres REAL y desechable: bloqueos, rollback y
 * concurrencia no se pueden probar con mocks. Se omite si TEST_DATABASE_URL no
 * está definida y se niega a correr contra un host que no sea local.
 *
 *   docker run -d --name dorella-order-test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=dorella_test -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=postgresql://postgres:test@localhost:55432/dorella_test npx prisma db push --skip-generate
 *   TEST_DATABASE_URL=postgresql://postgres:test@localhost:55432/dorella_test npx vitest run src/tests/order-inventory.integration.test.ts
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const isLocal = TEST_DATABASE_URL ? ['localhost', '127.0.0.1'].includes(new URL(TEST_DATABASE_URL).hostname) : false;
if (TEST_DATABASE_URL && !isLocal) throw new Error('TEST_DATABASE_URL debe apuntar a una BD local desechable');

describe.skipIf(!TEST_DATABASE_URL)('pedidos manuales e inventario contra Postgres real', () => {
  let prisma: PrismaClient;
  let orders: typeof import('../services/order.service.js');
  let stockHelpers: typeof import('../services/inventory-stock.js');
  let categoryId: string;
  let adminId: string;
  const runTag = randomUUID().slice(0, 8);

  const comprador = { nombre: 'Karen', apellido: 'López', telefono: '3001234567', ciudad: 'Medellín', direccion: 'Calle 10', informacionEntrega: '', correo: null };
  const manual = (items: Array<{ productId: string; cantidad: number }>) =>
    orders.createManualOrder(adminId, { comprador, items: items.map((item) => ({ ...item, descuentoAdicional: 0 })), notas: '' });

  async function createProducts(specs: Array<{ stock: number; reserved?: number; sku?: string }>) {
    return Promise.all(specs.map((spec, i) => prisma.product.create({
      data: { sku: spec.sku ?? `IT-${runTag}-${randomUUID().slice(0, 8)}-${i}`, nombre: `Integración ${i}`, precioBase: 10_000, categoryId, stock: spec.stock, stockReservado: spec.reserved ?? 0 },
      select: { id: true },
    })));
  }
  const inventoryOf = async (id: string) => prisma.product.findUniqueOrThrow({ where: { id }, select: { stock: true, stockReservado: true } });
  const ordersWith = (productIds: string[]) => prisma.order.count({ where: { items: { some: { productId: { in: productIds } } } } });

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    ({ prisma } = await import('../config/db.js'));
    orders = await import('../services/order.service.js');
    stockHelpers = await import('../services/inventory-stock.js');
    categoryId = (await prisma.category.create({ data: { nombre: 'Integración', slug: `integracion-${runTag}` } })).id;
    adminId = (await prisma.user.create({ data: { email: `admin-${runTag}@test.local`, nombre: 'Admin', apellido: 'Test', passwordHash: 'x', role: 'admin' }, select: { id: true } })).id;
    // Falla inyectada SOLO en esta BD de prueba: rechaza cambiar el inventario de
    // los SKU FAILWRITE-*, después de que la orden y sus ítems ya se insertaron.
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION test_fail_stock_write() RETURNS trigger AS $$
      BEGIN IF NEW.sku LIKE 'FAILWRITE-%' AND (NEW.stock <> OLD.stock OR NEW.stock_reservado <> OLD.stock_reservado) THEN RAISE EXCEPTION 'falla simulada de escritura'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_fail_stock_write ON products');
    await prisma.$executeRawUnsafe('CREATE TRIGGER test_fail_stock_write BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION test_fail_stock_write()');
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('orden con un producto: stock real igual y stockReservado aumenta', async () => {
    const [p] = await createProducts([{ stock: 5 }]);
    const order = await manual([{ productId: p.id, cantidad: 2 }]);
    expect(order.items).toHaveLength(1);
    expect(await inventoryOf(p.id)).toEqual({ stock: 5, stockReservado: 2 });
    expect((await prisma.inventoryReservation.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe('active');
  });

  it('orden con varios productos reserva cada uno', async () => {
    const products = await createProducts(Array.from({ length: 25 }, () => ({ stock: 4 })));
    const order = await manual(products.map((p) => ({ productId: p.id, cantidad: 3 })));
    expect(order.items).toHaveLength(25);
    for (const p of products) expect(await inventoryOf(p.id)).toEqual({ stock: 4, stockReservado: 3 });
  });

  it('stock insuficiente: no crea orden ni cambia ningún inventario', async () => {
    const [a, b] = await createProducts([{ stock: 5 }, { stock: 2, reserved: 1 }]);
    await expect(manual([{ productId: a.id, cantidad: 1 }, { productId: b.id, cantidad: 2 }])).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect(await ordersWith([a.id, b.id])).toBe(0);
    expect(await inventoryOf(a.id)).toEqual({ stock: 5, stockReservado: 0 });
    expect(await inventoryOf(b.id)).toEqual({ stock: 2, stockReservado: 1 });
  });

  it('producto inexistente: falla sin crear orden', async () => {
    const [a] = await createProducts([{ stock: 5 }]);
    await expect(manual([{ productId: a.id, cantidad: 1 }, { productId: randomUUID(), cantidad: 1 }])).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    expect(await ordersWith([a.id])).toBe(0);
    expect(await inventoryOf(a.id)).toEqual({ stock: 5, stockReservado: 0 });
  });

  it('si falla la escritura de uno de varios productos, revierte orden, ítems, reserva e inventario', async () => {
    const [a, c] = await createProducts([{ stock: 5 }, { stock: 5 }]);
    const [failing] = await createProducts([{ stock: 5, sku: `FAILWRITE-${runTag}` }]);
    const before = { orders: await prisma.order.count(), reservations: await prisma.inventoryReservation.count() };
    await expect(manual([{ productId: a.id, cantidad: 1 }, { productId: failing.id, cantidad: 1 }, { productId: c.id, cantidad: 1 }])).rejects.toThrow();
    expect(await prisma.order.count()).toBe(before.orders);
    expect(await prisma.inventoryReservation.count()).toBe(before.reservations);
    expect(await prisma.orderItem.count({ where: { productId: { in: [a.id, failing.id, c.id] } } })).toBe(0);
    for (const id of [a.id, failing.id, c.id]) expect(await inventoryOf(id)).toEqual({ stock: 5, stockReservado: 0 });
  });

  it('dos órdenes concurrentes por la última unidad: solo una se completa', async () => {
    const [p] = await createProducts([{ stock: 1 }]);
    const results = await Promise.allSettled([manual([{ productId: p.id, cantidad: 1 }]), manual([{ productId: p.id, cantidad: 1 }])]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect(await inventoryOf(p.id)).toEqual({ stock: 1, stockReservado: 1 });
    expect(await ordersWith([p.id])).toBe(1);
  });

  it('8 órdenes concurrentes por 3 unidades (productos en distinto orden): exactamente 3 y sin deadlock', async () => {
    const [p, q] = await createProducts([{ stock: 3 }, { stock: 100 }]);
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) =>
      manual(i % 2 ? [{ productId: q.id, cantidad: 1 }, { productId: p.id, cantidad: 1 }] : [{ productId: p.id, cantidad: 1 }, { productId: q.id, cantidad: 1 }])));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    expect(await inventoryOf(p.id)).toEqual({ stock: 3, stockReservado: 3 });
    expect(await inventoryOf(q.id)).toEqual({ stock: 100, stockReservado: 3 });
  });

  it('marcar pagado reduce stock y stockReservado; cancelar después no devuelve dos veces', async () => {
    const [p] = await createProducts([{ stock: 4 }]);
    const order = await manual([{ productId: p.id, cantidad: 3 }]);
    expect((await orders.markOrderPaidManually(order.id, adminId)).outcome).toBe('paid');
    expect(await inventoryOf(p.id)).toEqual({ stock: 1, stockReservado: 0 });
    expect((await orders.markOrderPaidManually(order.id, adminId)).outcome).toBe('already_paid');
    expect(await inventoryOf(p.id)).toEqual({ stock: 1, stockReservado: 0 });
  });

  it('marcar pagado sin stock suficiente (reserva vencida y stock vendido): falla sin negativos ni pago registrado', async () => {
    const [p] = await createProducts([{ stock: 2 }]);
    const order = await manual([{ productId: p.id, cantidad: 2 }]);
    await orders.updateOrderStatus(order.id, 'cancelled'); // libera la reserva
    await prisma.product.update({ where: { id: p.id }, data: { stock: 1 } }); // se vendió una unidad por otro canal
    const result = await orders.markOrderPaidManually(order.id, adminId);
    expect(result.outcome).toBe('insufficient_stock');
    expect(await inventoryOf(p.id)).toEqual({ stock: 1, stockReservado: 0 });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { paymentStatus: true } })).paymentStatus).toBe('pending');
  });

  it('cancelar libera la reserva una sola vez', async () => {
    const [p] = await createProducts([{ stock: 5, reserved: 1 }]);
    const order = await manual([{ productId: p.id, cantidad: 2 }]);
    expect(await inventoryOf(p.id)).toEqual({ stock: 5, stockReservado: 3 });
    await orders.updateOrderStatus(order.id, 'cancelled');
    expect(await inventoryOf(p.id)).toEqual({ stock: 5, stockReservado: 1 });
    await orders.updateOrderStatus(order.id, 'cancelled');
    expect(await inventoryOf(p.id)).toEqual({ stock: 5, stockReservado: 1 });
  });

  it('el UPDATE protegido rechaza stock negativo, reservado negativo y reservado > stock', async () => {
    const [p] = await createProducts([{ stock: 2, reserved: 1 }]);
    const attempt = (delta: { stock?: number; reserved?: number }) =>
      prisma.$transaction((tx) => stockHelpers.applyInventoryDeltas(tx, [{ productId: p.id, ...delta }]));
    expect(await attempt({ stock: -3 })).toBe(false);
    expect(await attempt({ reserved: -2 })).toBe(false);
    expect(await attempt({ reserved: 2 })).toBe(false);
    expect(await attempt({ stock: -1 })).toBe(true);
    expect(await inventoryOf(p.id)).toEqual({ stock: 1, stockReservado: 1 });
    expect(await prisma.$transaction((tx) => stockHelpers.applyInventoryDeltas(tx, [{ productId: randomUUID(), stock: 1 }]))).toBe(false);
  });
});
