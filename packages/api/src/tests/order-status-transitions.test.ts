import { beforeEach, describe, expect, it, vi } from 'vitest';

const orderId = '44444444-4444-4444-8444-444444444444';

const mocks = vi.hoisted(() => {
  const state = {
    order: null as null | {
      id: string;
      status: string;
      sellerId: string | null;
      paymentStatus: string | null;
      paymentProvider: string | null;
      notas: string | null;
      orderNumber: string;
    },
  };

  const tx: any = {
    $queryRawUnsafe: vi.fn(async () => (state.order ? [{ id: state.order.id }] : [])),
    order: {
      findUnique: vi.fn(async ({ select }: any) => {
        if (!state.order) return null;
        // updateOrderStatus pide `include: { items: ... }` (sin select); markOrderPaidManually pide `select` explícito.
        if (select) {
          const picked: Record<string, unknown> = {};
          for (const key of Object.keys(select)) picked[key] = (state.order as any)[key];
          return picked;
        }
        return { ...state.order, items: [] };
      }),
      update: vi.fn(async ({ data }: any) => {
        Object.assign(state.order!, data);
        return { ...state.order };
      }),
    },
  };

  return {
    state,
    prisma: { $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(tx)) },
  };
});

vi.mock('../config/db.js', () => ({ prisma: mocks.prisma }));
vi.mock('../services/lot.service.js', () => ({ syncFifoCostsInBackground: vi.fn() }));
vi.mock('../services/inventory-reservation.service.js', () => ({
  cancelOnlineOrderInventory: vi.fn(async () => undefined),
  consumeReservationForManualPayment: vi.fn(async () => undefined),
  InventoryReservationError: class InventoryReservationError extends Error {},
  MANUAL_RESERVATION_TTL_MS: 1000,
  RESERVATION_TTL_MS: 1000,
  reserveInventoryForOrder: vi.fn(),
  releaseExpiredReservations: vi.fn(),
}));

const { updateOrderStatus, markOrderPaidManually, OrderError } = await import('../services/order.service.js');

function seedOrder(overrides: Partial<NonNullable<(typeof mocks.state)['order']>> = {}) {
  mocks.state.order = {
    id: orderId,
    status: 'pending',
    sellerId: 'seller-1',
    paymentStatus: null,
    paymentProvider: null,
    notas: null,
    orderNumber: 'DOR-1',
    ...overrides,
  };
}

describe('updateOrderStatus — máquina de estados', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pending → confirmed con pago aprobado: transición válida', async () => {
    seedOrder({ status: 'pending', paymentStatus: 'approved' });
    const updated = await updateOrderStatus(orderId, 'confirmed');
    expect(updated?.status).toBe('confirmed');
  });

  it('confirmed → preparado: transición válida', async () => {
    seedOrder({ status: 'confirmed', paymentStatus: 'approved' });
    const updated = await updateOrderStatus(orderId, 'preparado');
    expect(updated?.status).toBe('preparado');
  });

  it('preparado → shipped: transición válida, guarda shippedAt y la guía opcional en notas', async () => {
    seedOrder({ status: 'preparado', paymentStatus: 'approved' });
    const updated: any = await updateOrderStatus(orderId, 'shipped', {}, { guia: 'SERVIENTREGA-123' });
    expect(updated.status).toBe('shipped');
    expect(updated.shippedAt).toBeInstanceOf(Date);
    expect(updated.notas).toContain('SERVIENTREGA-123');
  });

  it('pending → shipped (salto de estados) se rechaza', async () => {
    seedOrder({ status: 'pending', paymentStatus: 'approved' });
    await expect(updateOrderStatus(orderId, 'shipped')).rejects.toThrow(OrderError);
  });

  it('delivered → cualquier cosa se rechaza (estado terminal)', async () => {
    seedOrder({ status: 'delivered' });
    await expect(updateOrderStatus(orderId, 'shipped')).rejects.toThrow(OrderError);
    await expect(updateOrderStatus(orderId, 'cancelled')).rejects.toThrow(OrderError);
  });

  it('reenviar el mismo estado es un no-op válido (idempotente)', async () => {
    seedOrder({ status: 'preparado', paymentStatus: 'approved' });
    const updated = await updateOrderStatus(orderId, 'preparado');
    expect(updated?.status).toBe('preparado');
  });

  it('comercial no puede cambiar el estado de un pedido ajeno (sellerId no coincide)', async () => {
    seedOrder({ status: 'confirmed', sellerId: 'seller-1', paymentStatus: 'approved' });
    const updated = await updateOrderStatus(orderId, 'preparado', { sellerId: 'otro-vendedor' });
    expect(updated).toBeNull();
  });
});

describe('markOrderPaidManually — aprobar pago y auto-confirmar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pedido pendiente de pago (WhatsApp) → paga y pasa a Confirmado en la misma operación', async () => {
    seedOrder({ status: 'pending', paymentProvider: null, paymentStatus: null });
    const result = await markOrderPaidManually(orderId, 'admin-1');
    expect(result.outcome).toBe('paid');
    if (result.outcome === 'paid') {
      expect(result.order.status).toBe('confirmed');
      expect(result.order.paymentStatus).toBe('approved');
    }
  });

  it('pedido ya pagado → already_paid, idempotente, no vuelve a tocar el estado', async () => {
    seedOrder({ status: 'confirmed', paymentProvider: null, paymentStatus: 'approved' });
    const result = await markOrderPaidManually(orderId, 'admin-1');
    expect(result.outcome).toBe('already_paid');
  });

  it('pedido con Mercado Pago (pago en línea) nunca se marca pagado manualmente', async () => {
    seedOrder({ status: 'pending', paymentProvider: 'mercadopago', paymentStatus: null });
    const result = await markOrderPaidManually(orderId, 'admin-1');
    expect(result.outcome).toBe('not_manual_order');
  });

  it('el comercial solo puede marcar pagado un pedido que él mismo vendió', async () => {
    seedOrder({ status: 'pending', sellerId: 'seller-1', paymentProvider: null, paymentStatus: null });
    const result = await markOrderPaidManually(orderId, 'seller-1', { sellerId: 'seller-distinto' });
    expect(result.outcome).toBe('not_found');
  });
});
