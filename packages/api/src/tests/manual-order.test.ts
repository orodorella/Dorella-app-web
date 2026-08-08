import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateManualOrderSchema } from '../validators/order.schema.js';

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    product: { findMany: vi.fn() },
    order: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  };
  return {
    tx,
    prisma: { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) },
  };
});

vi.mock('../config/db.js', () => ({ prisma: mocks.prisma }));

import { createManualOrder, OrderError, updateOrderStatus } from '../services/order.service.js';

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
    mocks.tx.$queryRawUnsafe.mockResolvedValue([]);
    mocks.tx.$executeRawUnsafe.mockResolvedValue(2);
    mocks.tx.product.findMany.mockResolvedValue([
      { id: validInput.items[0].productId, sku: 'AR-1', nombre: 'Aretes', precioBase: 100_000, stock: 10, stockReservado: 1 },
      { id: validInput.items[1].productId, sku: 'CA-1', nombre: 'Cadena', precioBase: 200_000, stock: 5, stockReservado: 0 },
    ]);
    mocks.tx.order.create.mockImplementation(async ({ data }: { data: Record<string, any> }) => ({
      id: '33333333-3333-4333-8333-333333333333', orderNumber: 'DOR-20260808-0001', status: 'pending',
      tierAtPurchase: data.tierAtPurchase, descuentoAplicado: data.descuentoAplicado, subtotal: data.subtotal,
      total: data.total, notas: data.notas, compradorNombre: data.compradorNombre,
      compradorApellido: data.compradorApellido, compradorTelefono: data.compradorTelefono,
      compradorEmail: data.compradorEmail, direccionEnvio: data.direccionEnvio, origen: data.origen,
      createdByAdminId: data.createdByAdminId, paymentStatus: data.paymentStatus,
      paymentProvider: data.paymentProvider, paidAt: null, createdAt: new Date('2026-08-08'), updatedAt: new Date('2026-08-08'),
      items: data.items.create.map((item: Record<string, any>, index: number) => ({ ...item, id: `item-${index}` })),
    }));
  });

  it('crea un pedido invitado con varios productos y calcula precios y total en backend', async () => {
    const result = await createManualOrder('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', CreateManualOrderSchema.parse(validInput));
    expect(result.total).toBe(400_000);
    expect(result.items).toHaveLength(2);
    expect(result.paymentStatus).toBe('pending');
    expect(result.paymentProvider).toBeNull();
    expect(result.origen).toBe('whatsapp');
    expect(mocks.tx.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: null, paymentStatus: 'pending', paymentProvider: null }) }));
    expect(mocks.tx.$executeRawUnsafe).toHaveBeenCalledOnce();
  });

  it('rechaza stock insuficiente sin crear pedido ni descontar ningún producto', async () => {
    mocks.tx.product.findMany.mockResolvedValue([
      { id: validInput.items[0].productId, sku: 'AR-1', nombre: 'Aretes', precioBase: 100_000, stock: 2, stockReservado: 1 },
      { id: validInput.items[1].productId, sku: 'CA-1', nombre: 'Cadena', precioBase: 200_000, stock: 5, stockReservado: 0 },
    ]);
    await expect(createManualOrder('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', CreateManualOrderSchema.parse(validInput))).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' } satisfies Partial<OrderError>);
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
    expect(mocks.tx.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('suma cantidades duplicadas antes de validar para impedir stock negativo', async () => {
    mocks.tx.product.findMany.mockResolvedValue([
      { id: validInput.items[0].productId, sku: 'AR-1', nombre: 'Aretes', precioBase: 100_000, stock: 3, stockReservado: 0 },
    ]);
    const duplicateInput = CreateManualOrderSchema.parse({ ...validInput, items: [{ productId: validInput.items[0].productId, cantidad: 2 }, { productId: validInput.items[0].productId, cantidad: 2 }] });
    await expect(createManualOrder('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', duplicateInput)).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect(mocks.tx.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});

describe('cancelación de pedido manual', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve el inventario una sola vez al cancelar', async () => {
    mocks.tx.$queryRawUnsafe.mockResolvedValue([{ id: 'order-1' }]);
    mocks.tx.order.findUnique.mockResolvedValue({ status: 'pending', paymentStatus: 'pending', origen: 'whatsapp', items: [{ productId: validInput.items[0].productId, cantidad: 2 }] });
    mocks.tx.order.update.mockResolvedValue({ id: 'order-1', status: 'cancelled' });
    await updateOrderStatus('33333333-3333-4333-8333-333333333333', 'cancelled');
    expect(mocks.tx.$executeRawUnsafe).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    mocks.tx.$queryRawUnsafe.mockResolvedValue([{ id: 'order-1' }]);
    mocks.tx.order.findUnique.mockResolvedValue({ status: 'cancelled', paymentStatus: 'pending', origen: 'whatsapp', items: [{ productId: validInput.items[0].productId, cantidad: 2 }] });
    mocks.tx.order.update.mockResolvedValue({ id: 'order-1', status: 'cancelled' });
    await updateOrderStatus('33333333-3333-4333-8333-333333333333', 'cancelled');
    expect(mocks.tx.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});
