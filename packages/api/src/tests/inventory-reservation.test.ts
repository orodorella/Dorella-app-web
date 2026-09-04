import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state = { reservationStatus: 'active' as 'active' | 'released' | 'consumed', stock: 5, reserved: 2 };
  const items = [{ productId: '11111111-1111-4111-8111-111111111111', sku: 'AR-1', nombreProducto: 'Aretes', cantidad: 2 }];
  const tx: any = {
    $queryRawUnsafe: vi.fn(),
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
