import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateManualOrderSchema } from '../validators/order.schema.js';

const validInput = {
  comprador: {
    nombre: 'Karen', apellido: 'López', telefono: '+57 300 123 4567', ciudad: 'Medellín',
    direccion: 'Calle 10 # 20-30', informacionEntrega: 'Apto 201', correo: '',
  },
  items: [
    { productId: '11111111-1111-4111-8111-111111111111', cantidad: 2 },
    { productId: '22222222-2222-4222-8222-222222222222', cantidad: 1 },
  ],
  notas: 'Pedido recibido por WhatsApp',
};

const orderId = '33333333-3333-4333-8333-333333333333';

const mocks = vi.hoisted(() => {
  const state = {
    stock: new Map<string, number>(),
    reserved: new Map<string, number>(),
    reservationStatus: null as 'active' | 'released' | 'consumed' | null,
    orderItems: [] as Array<{ productId: string; sku: string; nombreProducto: string; cantidad: number }>,
    orderStatus: 'pending' as string,
  };

  const tx: any = {
    $queryRawUnsafe: vi.fn(async () => [{ id: orderId }]),
    product: {
      findMany: vi.fn(async ({ where }: any) => {
        const ids: string[] = where.id.in;
        return ids.map((id) => ({
          id,
          sku: id === validInput.items[0].productId ? 'AR-1' : 'CA-1',
          nombre: id === validInput.items[0].productId ? 'Aretes' : 'Cadena',
          precioBase: id === validInput.items[0].productId ? 100_000 : 200_000,
          stock: state.stock.get(id) ?? 0,
          stockReservado: state.reserved.get(id) ?? 0,
        }));
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const id = where.id;
        if (data.stockReservado?.increment) state.reserved.set(id, (state.reserved.get(id) ?? 0) + data.stockReservado.increment);
        if (data.stockReservado?.decrement) state.reserved.set(id, (state.reserved.get(id) ?? 0) - data.stockReservado.decrement);
        if (data.stock?.increment) state.stock.set(id, (state.stock.get(id) ?? 0) + data.stock.increment);
        if (data.stock?.decrement) state.stock.set(id, (state.stock.get(id) ?? 0) - data.stock.decrement);
      }),
    },
    order: {
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
        state.orderItems = data.items.create.map((item: any) => ({
          productId: item.productId, sku: item.sku, nombreProducto: item.nombreProducto, cantidad: item.cantidad,
        }));
        return {
          id: orderId, orderNumber: 'DOR-20260808-0001', status: 'pending',
          tierAtPurchase: data.tierAtPurchase, descuentoAplicado: data.descuentoAplicado, subtotal: data.subtotal,
          total: data.total, notas: data.notas, compradorNombre: data.compradorNombre,
          compradorApellido: data.compradorApellido, compradorTelefono: data.compradorTelefono,
          compradorEmail: data.compradorEmail, direccionEnvio: data.direccionEnvio, origen: data.origen,
          createdByAdminId: data.createdByAdminId, paymentStatus: data.paymentStatus,
          paymentProvider: data.paymentProvider, paidAt: null, createdAt: new Date('2026-08-08'), updatedAt: new Date('2026-08-08'),
          items: data.items.create.map((item: Record<string, any>, index: number) => ({ ...item, id: `item-${index}` })),
        };
      }),
      findUnique: vi.fn(async () => ({
        id: orderId,
        orderNumber: 'DOR-20260808-0001',
        status: state.orderStatus,
        paymentStatus: 'pending',
        paymentProvider: null,
        origen: 'whatsapp',
        items: state.orderItems,
        inventoryReservation: state.reservationStatus
          ? { status: state.reservationStatus, expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) }
          : null,
      })),
      update: vi.fn(async ({ data }: any) => {
        if (data.status) state.orderStatus = data.status;
        return { id: orderId, orderNumber: 'DOR-20260808-0001', status: state.orderStatus, paymentStatus: data.paymentStatus ?? 'pending' };
      }),
    },
    inventoryReservation: {
      upsert: vi.fn(async () => { state.reservationStatus = 'active'; }),
      findUnique: vi.fn(async () => (state.reservationStatus ? { status: state.reservationStatus } : null)),
      update: vi.fn(async ({ data }: any) => { state.reservationStatus = data.status; }),
    },
  };

  return {
    state,
    tx,
    prisma: { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) },
  };
});

vi.mock('../config/db.js', () => ({ prisma: mocks.prisma }));

import { createManualOrder, markOrderPaidManually, OrderError, updateOrderStatus } from '../services/order.service.js';

describe('CreateManualOrderSchema', () => {
  it('acepta correo vacío y lo normaliza a null', () => {
    expect(CreateManualOrderSchema.parse(validInput).comprador.correo).toBeNull();
  });

  it('acepta un correo válido y rechaza uno inválido', () => {
    expect(CreateManualOrderSchema.parse({ ...validInput, comprador: { ...validInput.comprador, correo: 'karen@example.com' } }).comprador.correo).toBe('karen@example.com');
    expect(() => CreateManualOrderSchema.parse({ ...validInput, comprador: { ...validInput.comprador, correo: 'no-es-correo' } })).toThrow();
  });

  it('rechaza precios, subtotales o totales enviados por el navegador', () => {
    expect(() => CreateManualOrderSchema.parse({ ...validInput, total: 1 })).toThrow();
    expect(() => CreateManualOrderSchema.parse({ ...validInput, items: [{ ...validInput.items[0], precio: 1 }] })).toThrow();
  });
});

describe('createManualOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.stock = new Map([[validInput.items[0].productId, 10], [validInput.items[1].productId, 5]]);
    mocks.state.reserved = new Map([[validInput.items[0].productId, 1], [validInput.items[1].productId, 0]]);
    mocks.state.reservationStatus = null;
    mocks.state.orderStatus = 'pending';
    mocks.tx.$queryRawUnsafe.mockResolvedValue([{ id: orderId }]);
  });

  it('crea un pedido invitado con varios productos, calcula precios y RESERVA stock sin descontarlo', async () => {
    const result = await createManualOrder('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', CreateManualOrderSchema.parse(validInput));
    expect(result.total).toBe(400_000);
    expect(result.items).toHaveLength(2);
    expect(result.paymentStatus).toBe('pending');
    expect(result.paymentProvider).toBeNull();
    expect(result.origen).toBe('whatsapp');
    expect(mocks.tx.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: null, paymentStatus: 'pending', paymentProvider: null }) }));

    // Real stock is untouched — only stockReservado moved.
    expect(mocks.state.stock.get(validInput.items[0].productId)).toBe(10);
    expect(mocks.state.stock.get(validInput.items[1].productId)).toBe(5);
    expect(mocks.state.reserved.get(validInput.items[0].productId)).toBe(1 + 2);
    expect(mocks.state.reserved.get(validInput.items[1].productId)).toBe(0 + 1);
    expect(mocks.tx.inventoryReservation.upsert).toHaveBeenCalledOnce();
  });

  it('rechaza stock insuficiente sin crear pedido ni reservar nada', async () => {
    mocks.state.stock.set(validInput.items[0].productId, 2);
    mocks.state.reserved.set(validInput.items[0].productId, 1);
    await expect(createManualOrder('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', CreateManualOrderSchema.parse(validInput))).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' } satisfies Partial<OrderError>);
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
    expect(mocks.tx.inventoryReservation.upsert).not.toHaveBeenCalled();
  });

  it('suma cantidades duplicadas antes de validar para impedir stock negativo', async () => {
    mocks.state.stock = new Map([[validInput.items[0].productId, 3]]);
    mocks.state.reserved = new Map([[validInput.items[0].productId, 0]]);
    const duplicateInput = CreateManualOrderSchema.parse({ ...validInput, items: [{ productId: validInput.items[0].productId, cantidad: 2 }, { productId: validInput.items[0].productId, cantidad: 2 }] });
    await expect(createManualOrder('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', duplicateInput)).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect(mocks.tx.inventoryReservation.upsert).not.toHaveBeenCalled();
  });
});

describe('cancelación de pedido manual pendiente (reserva, no stock)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.stock = new Map([[validInput.items[0].productId, 10]]);
    mocks.state.reserved = new Map([[validInput.items[0].productId, 2]]);
    mocks.state.reservationStatus = 'active';
    mocks.state.orderItems = [{ productId: validInput.items[0].productId, sku: 'AR-1', nombreProducto: 'Aretes', cantidad: 2 }];
    mocks.state.orderStatus = 'pending';
  });

  it('libera la reserva (no descuenta stock, que nunca se tocó) y es idempotente', async () => {
    await updateOrderStatus(orderId, 'cancelled');
    expect(mocks.state.reservationStatus).toBe('released');
    expect(mocks.state.reserved.get(validInput.items[0].productId)).toBe(0);
    expect(mocks.state.stock.get(validInput.items[0].productId)).toBe(10); // never decremented, so nothing to give back

    vi.clearAllMocks();
    // Second cancel of an already-cancelled order must not touch inventory again.
    await updateOrderStatus(orderId, 'cancelled');
    expect(mocks.tx.inventoryReservation.update).not.toHaveBeenCalled();
    expect(mocks.tx.product.update).not.toHaveBeenCalled();
  });
});

describe('markOrderPaidManually — consume la reserva al pagar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.stock = new Map([[validInput.items[0].productId, 10]]);
    mocks.state.reserved = new Map([[validInput.items[0].productId, 2]]);
    mocks.state.reservationStatus = 'active';
    mocks.state.orderItems = [{ productId: validInput.items[0].productId, sku: 'AR-1', nombreProducto: 'Aretes', cantidad: 2 }];
    mocks.state.orderStatus = 'pending';
  });

  it('descuenta stock real recién cuando se marca como pagado, no antes', async () => {
    expect(mocks.state.stock.get(validInput.items[0].productId)).toBe(10);
    const result = await markOrderPaidManually(orderId, 'admin-1');
    expect(result.outcome).toBe('paid');
    expect(mocks.state.stock.get(validInput.items[0].productId)).toBe(8);
    expect(mocks.state.reserved.get(validInput.items[0].productId)).toBe(0);
    expect(mocks.state.reservationStatus).toBe('consumed');
  });

  it('re-adquiere la reserva si ya había expirado/liberado antes de pagar, y descuenta igual', async () => {
    mocks.state.reservationStatus = 'released';
    mocks.state.reserved.set(validInput.items[0].productId, 0);
    const result = await markOrderPaidManually(orderId, 'admin-1');
    expect(result.outcome).toBe('paid');
    expect(mocks.state.stock.get(validInput.items[0].productId)).toBe(8);
  });

  it('si ya no hay stock disponible al pagar, falla y NO marca el pedido como pagado', async () => {
    mocks.state.reservationStatus = 'released';
    mocks.state.reserved.set(validInput.items[0].productId, 0);
    mocks.state.stock.set(validInput.items[0].productId, 1); // less than the 2 requested
    const result = await markOrderPaidManually(orderId, 'admin-1');
    expect(result.outcome).toBe('insufficient_stock');
    expect(mocks.state.stock.get(validInput.items[0].productId)).toBe(1); // untouched
    expect(mocks.tx.order.update).not.toHaveBeenCalled();
  });
});
