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
    cliente: null as { id: string; tier: 'detal' | 'por_mayor' | 'gran_mayor' } | null,
  };

  const tx: any = {
    $queryRawUnsafe: vi.fn(async () => [{ id: orderId }]),
    user: {
      findFirst: vi.fn(async ({ where }: any) => (
        state.cliente && state.cliente.id === where.id ? state.cliente : null
      )),
    },
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
    // Simula el UPDATE único de applyInventoryDeltas con las condiciones de su WHERE.
    $executeRaw: vi.fn(async (query: { values: unknown[] }) => {
      let updated = 0;
      for (let i = 0; i < query.values.length; i += 3) {
        const [id, stockDelta, reservedDelta] = query.values.slice(i, i + 3) as [string, number, number];
        if (!state.stock.has(id)) continue;
        const stock = state.stock.get(id)! + stockDelta;
        const reserved = (state.reserved.get(id) ?? 0) + reservedDelta;
        if (stock < 0 || reserved < 0 || reserved > stock) continue;
        state.stock.set(id, stock);
        state.reserved.set(id, reserved);
        updated += 1;
      }
      return updated;
    }),
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

import { Prisma } from '@prisma/client';
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

describe('createManualOrder con cliente registrado', () => {
  const clienteId = '99999999-9999-4999-8999-999999999999';
  const adminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.stock = new Map([[validInput.items[0].productId, 10], [validInput.items[1].productId, 5]]);
    mocks.state.reserved = new Map([[validInput.items[0].productId, 0], [validInput.items[1].productId, 0]]);
    mocks.state.reservationStatus = null;
    mocks.state.orderStatus = 'pending';
    mocks.state.cliente = { id: clienteId, tier: 'por_mayor' };
    mocks.tx.$queryRawUnsafe.mockResolvedValue([{ id: orderId }]);
  });

  it('toma el nivel del cliente sin que nadie lo elija', async () => {
    const input = CreateManualOrderSchema.parse({ ...validInput, userId: clienteId });
    const result = await createManualOrder(adminId, input);

    // 400.000 de base con el -37,5% de "por mayor".
    expect(result.total).toBe(250_000);
    expect(result.tierAtPurchase).toBe('por_mayor');
    expect(result.descuentoAplicado).toBe(0.375);
    expect(mocks.tx.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: clienteId, tierAtPurchase: 'por_mayor', descuentoAplicado: 0.375 }),
    }));
  });

  it('aplica el descuento adicional encima del precio del nivel', async () => {
    const input = CreateManualOrderSchema.parse({
      ...validInput,
      userId: clienteId,
      items: [{ ...validInput.items[0], descuentoAdicional: 10 }, validInput.items[1]],
    });
    const result = await createManualOrder(adminId, input);

    // 100.000 → 62.500 (nivel) → 56.250 (-10%) por 2, más 125.000 de la cadena.
    expect(result.total).toBe(237_500);
    expect(result.items.find((item) => item.sku === 'AR-1')?.precioUnitario).toBe(56_250);
  });

  it('sin cliente el pedido sigue yendo a precio detal', async () => {
    mocks.state.cliente = null;
    const result = await createManualOrder(adminId, CreateManualOrderSchema.parse(validInput));

    expect(result.total).toBe(400_000);
    expect(result.tierAtPurchase).toBe('detal');
  });

  it('falla claro si el cliente no existe o está inactivo, sin crear el pedido', async () => {
    mocks.state.cliente = null;
    const input = CreateManualOrderSchema.parse({ ...validInput, userId: clienteId });

    await expect(createManualOrder(adminId, input)).rejects.toThrow(OrderError);
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
  });
});

describe('CreateManualOrderSchema · cliente y descuento adicional', () => {
  it('el descuento adicional por defecto es 0', () => {
    expect(CreateManualOrderSchema.parse(validInput).items[0].descuentoAdicional).toBe(0);
  });

  it('acepta un porcentaje válido y rechaza los imposibles', () => {
    const conDescuento = CreateManualOrderSchema.parse({
      ...validInput,
      items: [{ ...validInput.items[0], descuentoAdicional: 12.5 }],
    });
    expect(conDescuento.items[0].descuentoAdicional).toBe(12.5);
    expect(() => CreateManualOrderSchema.parse({ ...validInput, items: [{ ...validInput.items[0], descuentoAdicional: 101 }] })).toThrow();
    expect(() => CreateManualOrderSchema.parse({ ...validInput, items: [{ ...validInput.items[0], descuentoAdicional: -1 }] })).toThrow();
  });

  it('rechaza un userId que no es uuid', () => {
    expect(() => CreateManualOrderSchema.parse({ ...validInput, userId: 'no-es-uuid' })).toThrow();
  });
});

describe('orden manual: inventario en número constante de sentencias', () => {
  const adminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const P1 = validInput.items[0].productId;
  const P2 = validInput.items[1].productId;
  const many = Array.from({ length: 200 }, (_, i) => `66666666-6666-4666-8666-${String(i).padStart(12, '0')}`);
  const manyInput = () => CreateManualOrderSchema.parse({ ...validInput, items: many.map((productId) => ({ productId, cantidad: 1 })) });

  // Cuenta cada llamada a tx (en producción, cada una es un viaje de red).
  function txCalls(): number {
    const count = (obj: Record<string, any>): number => Object.values(obj).reduce((sum: number, value: any) => {
      if (typeof value === 'function' && 'mock' in value) return sum + value.mock.calls.length;
      if (value && typeof value === 'object') return sum + count(value);
      return sum;
    }, 0);
    return count(mocks.tx);
  }

  // Transacción con reloj de latencia: cada llamada a tx suma `latencyMs`; al
  // superar el timeout, Prisma descarta la transacción y la siguiente llamada
  // falla con P2028 "Transaction not found", como en producción.
  function withLatencyBudget(target: any, latencyMs: number, timeoutMs: number) {
    let elapsed = 0;
    const wrap = (obj: any): any => new Proxy(obj, {
      get(t, key) {
        const value = t[key];
        if (typeof value === 'function') {
          return (...args: unknown[]) => {
            elapsed += latencyMs;
            if (elapsed > timeoutMs) {
              return Promise.reject(new Prisma.PrismaClientKnownRequestError(
                'Invalid `prisma.product.update()` invocation: Transaction API error: Transaction not found.',
                { code: 'P2028', clientVersion: 'test' },
              ));
            }
            return value.apply(t, args);
          };
        }
        return value && typeof value === 'object' ? wrap(value) : value;
      },
    });
    return wrap(target);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.stock = new Map([[P1, 10], [P2, 5], ...many.map((id) => [id, 3] as [string, number])]);
    mocks.state.reserved = new Map([[P1, 0], [P2, 0], ...many.map((id) => [id, 0] as [string, number])]);
    mocks.state.reservationStatus = null;
    mocks.state.orderStatus = 'pending';
    mocks.state.cliente = null;
    mocks.tx.$queryRawUnsafe.mockResolvedValue([{ id: orderId }]);
  });

  it('un solo producto: stock real igual y stockReservado aumenta', async () => {
    await createManualOrder(adminId, CreateManualOrderSchema.parse({ ...validInput, items: [{ productId: P2, cantidad: 3 }] }));
    expect(mocks.state.stock.get(P2)).toBe(5);
    expect(mocks.state.reserved.get(P2)).toBe(3);
  });

  it('producto inexistente o inactivo: falla sin crear pedido ni reservar', async () => {
    mocks.tx.product.findMany.mockResolvedValueOnce([]);
    await expect(createManualOrder(adminId, CreateManualOrderSchema.parse(validInput))).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('si el UPDATE protegido falla tras insertar la orden, lanza para que la transacción revierta todo', async () => {
    mocks.tx.$executeRaw.mockResolvedValueOnce(1); // solo 1 de 2 productos pudo reservarse
    await expect(createManualOrder(adminId, CreateManualOrderSchema.parse(validInput))).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect(mocks.tx.order.create).toHaveBeenCalledOnce();
    expect(mocks.tx.inventoryReservation.upsert).not.toHaveBeenCalled();
  });

  it('1 producto y 200 productos hacen las mismas llamadas a tx, sin product.update', async () => {
    await createManualOrder(adminId, CreateManualOrderSchema.parse({ ...validInput, items: [{ productId: P1, cantidad: 1 }] }));
    const single = txCalls();
    vi.clearAllMocks();
    await createManualOrder(adminId, manyInput());
    expect(txCalls()).toBe(single);
    expect(mocks.tx.$executeRaw).toHaveBeenCalledOnce();
    expect(mocks.tx.product.update).not.toHaveBeenCalled();
    expect(many.every((id) => mocks.state.reserved.get(id) === 1 && mocks.state.stock.get(id) === 3)).toBe(true);
  });

  it('marcar pagado y cancelar un pedido de 200 productos: un UPDATE cada uno', async () => {
    mocks.state.orderItems = many.map((productId) => ({ productId, sku: 'X', nombreProducto: 'X', cantidad: 1 }));
    mocks.state.reservationStatus = 'active';
    for (const id of many) mocks.state.reserved.set(id, 1);
    expect((await markOrderPaidManually(orderId, 'admin-1')).outcome).toBe('paid');
    expect(mocks.tx.$executeRaw).toHaveBeenCalledOnce();
    expect(many.every((id) => mocks.state.stock.get(id) === 2 && mocks.state.reserved.get(id) === 0)).toBe(true);

    vi.clearAllMocks();
    mocks.state.orderStatus = 'pending';
    mocks.state.reservationStatus = 'active';
    for (const id of many) mocks.state.reserved.set(id, 1);
    await updateOrderStatus(orderId, 'cancelled');
    expect(mocks.tx.$executeRaw).toHaveBeenCalledOnce();
    expect(mocks.tx.product.update).not.toHaveBeenCalled();
    expect(many.every((id) => mocks.state.reserved.get(id) === 0)).toBe(true);
  });

  it('regresión: con 70 ms por sentencia y el timeout de 5 s, 200 productos ya no vencen la transacción', async () => {
    mocks.prisma.$transaction.mockImplementationOnce(async (callback: (client: any) => unknown) => callback(withLatencyBudget(mocks.tx, 70, 5_000)));
    await expect(createManualOrder(adminId, manyInput())).resolves.toMatchObject({ origen: 'whatsapp' });
  });

  it('control: el patrón anterior (un product.update por producto) reproduce P2028 con la misma latencia', async () => {
    const tx = withLatencyBudget(mocks.tx, 70, 5_000);
    const legacy = (async () => {
      for (const id of many) await tx.product.update({ where: { id }, data: { stockReservado: { increment: 1 } } });
    })();
    await expect(legacy).rejects.toMatchObject({ code: 'P2028', message: expect.stringContaining('Transaction not found') });
  });
});
