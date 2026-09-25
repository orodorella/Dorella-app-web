import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state = { reservationStatus: 'active' as 'active' | 'released' | 'consumed', stock: 5, reserved: 2 };
  const items = [{ productId: '11111111-1111-4111-8111-111111111111', sku: 'AR-1', nombreProducto: 'Aretes', cantidad: 2 }];
  const tx: any = {
    $queryRawUnsafe: vi.fn(),
    // Simula el UPDATE único de applyInventoryDeltas: tripletas (id, Δstock,
    // Δreservado) con las mismas condiciones de su WHERE.
    $executeRaw: vi.fn(async (query: { values: unknown[] }) => {
      let updated = 0;
      for (let i = 0; i < query.values.length; i += 3) {
        const [, stockDelta, reservedDelta] = query.values.slice(i, i + 3) as [string, number, number];
        const stock = state.stock + stockDelta;
        const reserved = state.reserved + reservedDelta;
        if (stock < 0 || reserved < 0 || reserved > stock) continue;
        state.stock = stock;
        state.reserved = reserved;
        updated += 1;
      }
      return updated;
    }),
    product: {
      findMany: vi.fn(() => [{ id: items[0].productId, stock: state.stock, stockReservado: state.reserved }]),
      update: vi.fn(async ({ data }: any) => {
        if (data.stockReservado?.increment) state.reserved += data.stockReservado.increment;
        if (data.stockReservado?.decrement) state.reserved -= data.stockReservado.decrement;
        if (data.stock?.decrement) state.stock -= data.stock.decrement;
      }),
    },
    order: {
      findUnique: vi.fn(async () => ({
        userId: '22222222-2222-4222-8222-222222222222', total: 100_000, purchaseCreditedAt: null,
        inventoryReservation: { status: state.reservationStatus, expiresAt: new Date(Date.now() + 60_000) }, items,
      })),
      update: vi.fn(),
    },
    inventoryReservation: {
      upsert: vi.fn(async ({ update }: any) => { state.reservationStatus = update.status; }),
      findUnique: vi.fn(async () => ({ status: state.reservationStatus })),
      update: vi.fn(async ({ data }: any) => { state.reservationStatus = data.status; }),
    },
    user: { update: vi.fn(async () => ({ tier: 'detal', totalComprasAcumulado: 100_000 })) },
    tierChangeLog: { create: vi.fn() },
  };
  const prisma: any = {
    $transaction: vi.fn(async (callback: any) => callback(tx)),
    inventoryReservation: { findMany: vi.fn() },
  };
  return { state, items, tx, prisma };
});

vi.mock('../config/db.js', () => ({ prisma: mocks.prisma }));

import {
  InventoryReservationError,
  consumeReservationAndCreditPurchase,
  consumeReservationForManualPayment,
  releaseOrderReservation,
  reserveInventoryForOrder,
} from '../services/inventory-reservation.service.js';

describe('ciclo de reserva de inventario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.stock = 5;
    mocks.state.reserved = 0;
    mocks.state.reservationStatus = 'active';
  });

  it('reserva unidades sin reducir stock real', async () => {
    await reserveInventoryForOrder(mocks.tx, '33333333-3333-4333-8333-333333333333', new Date(Date.now() + 60_000));
    expect(mocks.state.stock).toBe(5);
    expect(mocks.state.reserved).toBe(2);
    expect(mocks.tx.inventoryReservation.upsert).toHaveBeenCalledOnce();
  });

  it('calcula disponibilidad usando stock menos stockReservado y rechaza faltantes', async () => {
    mocks.state.reserved = 4;
    await expect(reserveInventoryForOrder(mocks.tx, '33333333-3333-4333-8333-333333333333', new Date())).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' } satisfies Partial<InventoryReservationError>);
    expect(mocks.state.stock).toBe(5);
    expect(mocks.state.reserved).toBe(4);
  });

  it('aprobación consume stock y reserva exactamente una vez y acredita la compra', async () => {
    mocks.state.reserved = 2;
    await consumeReservationAndCreditPurchase(mocks.tx, '33333333-3333-4333-8333-333333333333', new Date());
    expect(mocks.state.stock).toBe(3);
    expect(mocks.state.reserved).toBe(0);
    expect(mocks.state.reservationStatus).toBe('consumed');
    expect(mocks.tx.user.update).toHaveBeenCalledOnce();
    expect(mocks.tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ purchaseCreditedAt: expect.any(Date) }) }));
  });

  it('liberación es idempotente y no incrementa stock real', async () => {
    mocks.state.reserved = 2;
    expect(await releaseOrderReservation('33333333-3333-4333-8333-333333333333')).toBe(true);
    expect(await releaseOrderReservation('33333333-3333-4333-8333-333333333333')).toBe(false);
    expect(mocks.state.stock).toBe(5);
    expect(mocks.state.reserved).toBe(0);
    expect(mocks.state.reservationStatus).toBe('released');
  });
});

describe('consumeReservationForManualPayment (pedidos manuales/WhatsApp)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.stock = 5;
    mocks.state.reserved = 2;
    mocks.state.reservationStatus = 'active';
  });

  it('descuenta stock real y no toca tier ni compras acumuladas', async () => {
    await consumeReservationForManualPayment(mocks.tx, '33333333-3333-4333-8333-333333333333', new Date());
    expect(mocks.state.stock).toBe(3);
    expect(mocks.state.reserved).toBe(0);
    expect(mocks.state.reservationStatus).toBe('consumed');
    expect(mocks.tx.user.update).not.toHaveBeenCalled();
    expect(mocks.tx.tierChangeLog.create).not.toHaveBeenCalled();
  });

  it('re-adquiere la reserva si ya estaba liberada y falla si ya no hay stock', async () => {
    mocks.state.reservationStatus = 'released';
    mocks.state.reserved = 0;
    mocks.state.stock = 1; // less than the 2 requested by the fixture item
    await expect(consumeReservationForManualPayment(mocks.tx, '33333333-3333-4333-8333-333333333333', new Date()))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' } satisfies Partial<InventoryReservationError>);
    expect(mocks.state.stock).toBe(1);
  });
});

describe('actualización masiva de inventario (regresión P2028 "Transaction not found")', () => {
  const orderId = '33333333-3333-4333-8333-333333333333';
  const manyItems = Array.from({ length: 100 }, (_, i) => ({
    productId: `55555555-5555-4555-8555-${String(i).padStart(12, '0')}`, sku: `S-${i}`, nombreProducto: `P${i}`, cantidad: 1,
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.stock = 5;
    mocks.state.reserved = 0;
    mocks.state.reservationStatus = 'active';
  });

  it('reservar 100 productos ejecuta un solo UPDATE y ningún product.update', async () => {
    mocks.tx.order.findUnique.mockResolvedValueOnce({ items: manyItems });
    mocks.tx.product.findMany.mockReturnValueOnce(manyItems.map((item) => ({ id: item.productId, stock: 5, stockReservado: 0 })));
    mocks.tx.$executeRaw.mockResolvedValueOnce(100);
    await reserveInventoryForOrder(mocks.tx, orderId, new Date(Date.now() + 60_000));
    expect(mocks.tx.$executeRaw).toHaveBeenCalledOnce();
    expect(mocks.tx.$executeRaw.mock.calls[0][0].values).toHaveLength(300);
    expect(mocks.tx.product.update).not.toHaveBeenCalled();
  });

  it('pago manual y liberación tampoco usan product.update', async () => {
    mocks.state.reserved = 2;
    await consumeReservationForManualPayment(mocks.tx, orderId, new Date());
    mocks.state.reservationStatus = 'active';
    mocks.state.reserved = 2;
    await releaseOrderReservation(orderId);
    expect(mocks.tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(mocks.tx.product.update).not.toHaveBeenCalled();
  });

  it('si el UPDATE protegido no aplica a todas las filas, la reserva falla antes de registrarse', async () => {
    mocks.tx.$executeRaw.mockResolvedValueOnce(0);
    await expect(reserveInventoryForOrder(mocks.tx, orderId, new Date(Date.now() + 60_000)))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' } satisfies Partial<InventoryReservationError>);
    expect(mocks.tx.inventoryReservation.upsert).not.toHaveBeenCalled();
  });

  it('liberar una reserva inconsistente falla sin dejar stockReservado negativo', async () => {
    mocks.state.reserved = 1; // el pedido reservó 2
    await expect(releaseOrderReservation(orderId)).rejects.toMatchObject({ code: 'INVENTORY_CONFLICT' });
    expect(mocks.state.reserved).toBe(1);
    expect(mocks.state.reservationStatus).toBe('active');
  });

  it('pago manual: si el stock ya no alcanza, falla sin dejar negativos ni consumir la reserva', async () => {
    mocks.state.stock = 2;
    mocks.state.reserved = 2;
    mocks.tx.$executeRaw.mockResolvedValueOnce(0);
    await expect(consumeReservationForManualPayment(mocks.tx, orderId, new Date())).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect(mocks.state.stock).toBe(2);
    expect(mocks.state.reservationStatus).toBe('active');
  });
});
