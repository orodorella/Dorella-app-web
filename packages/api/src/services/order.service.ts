import type { Tier } from 'shared/src/types/user.js';
import type { Prisma } from '@prisma/client';
import { TIER_CONFIG } from 'shared/src/constants/tiers.js';
import { prisma } from '../config/db.js';
import { calculatePrice } from './pricing.service.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';
import type { CreateManualOrderInput, CreateOrderInput } from '../validators/order.schema.js';
import {
  cancelOnlineOrderInventory,
  consumeReservationForManualPayment,
  InventoryReservationError,
  MANUAL_RESERVATION_TTL_MS,
  RESERVATION_TTL_MS,
  reserveInventoryForOrder,
  releaseExpiredReservations,
} from './inventory-reservation.service.js';

function generateOrderNumber(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `DOR-${y}${m}${d}-${rand}`;
}

type OrderItemInput = { productId: string; cantidad: number };

async function prepareOrderItems(
  tx: Prisma.TransactionClient,
  rawItems: OrderItemInput[],
  tier: Tier,
) {
  const quantities = new Map<string, number>();
  for (const item of rawItems) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.cantidad);
  const items = [...quantities.entries()].map(([productId, cantidad]) => ({ productId, cantidad }));
  const productIds = items.map((item) => item.productId).sort();

  await tx.$queryRawUnsafe(
    `SELECT id FROM products WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
    productIds,
  );

  const products = await tx.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    select: { id: true, sku: true, nombre: true, precioBase: true, stock: true, stockReservado: true },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));
  let subtotal = 0;
  let total = 0;

  const orderItems = items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new OrderError('PRODUCT_NOT_FOUND', `Producto ${item.productId} no encontrado`);
    const disponible = product.stock - product.stockReservado;
    if (disponible < item.cantidad) {
      throw new OrderError('INSUFFICIENT_STOCK', `Stock insuficiente para ${product.nombre}. Disponible: ${disponible}`);
    }
    const precioBase = Number(product.precioBase);
    const precioUnitario = calculatePrice(precioBase, tier);
    const lineSubtotal = precioUnitario * item.cantidad;
    subtotal += precioBase * item.cantidad;
    total += lineSubtotal;
    return {
      productId: product.id,
      sku: product.sku,
      nombreProducto: product.nombre,
      cantidad: item.cantidad,
      precioUnitario,
      precioBaseSnapshot: precioBase,
      subtotal: lineSubtotal,
    };
  });

  return { items, orderItems, subtotal, total };
}

interface OrderResult {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    tierAtPurchase: string;
    descuentoAplicado: number;
    subtotal: number;
    total: number;
    items: Array<{
      id: string;
      sku: string;
      nombreProducto: string;
      cantidad: number;
      precioUnitario: number;
      subtotal: number;
    }>;
    createdAt: string;
  };
  tierUpgrade: TierUpgradeResult;
}

export interface TierUpgradeResult {
  upgraded: boolean;
  newTier: Tier;
  previousTier: Tier;
}

export async function createOrder(
  userId: string,
  input: CreateOrderInput,
  currentTier: Tier,
): Promise<OrderResult> {
  const descuento = TIER_CONFIG[currentTier].descuento;

  const order = await prisma.$transaction(async (tx) => {
    const prepared = await prepareOrderItems(tx, input.items, currentTier);

    const orderNumber = generateOrderNumber();

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { nombre: true, apellido: true, telefono: true, email: true, direccion: true, ciudad: true, departamento: true },
    });
    if (!user) throw new OrderError('USER_NOT_FOUND', 'Usuario no encontrado');

    const telefonoCompleto = input.envio.telefonoCompleto.trim() || `+${input.envio.telefonoIndicativo} ${input.envio.telefonoNumero}`.trim();

    const createdOrder = await tx.order.create({
      data: {
        orderNumber,
        userId,
        tierAtPurchase: currentTier,
        descuentoAplicado: descuento,
        subtotal: prepared.subtotal,
        total: prepared.total,
        direccionEnvio: {
          pais: input.envio.pais,
          paisCodigo: input.envio.paisCodigo,
          region: input.envio.region,
          regionCodigo: input.envio.regionCodigo ?? null,
          departamento: input.envio.region,
          ciudad: input.envio.ciudad,
          direccion: input.envio.direccion,
          referencias: input.envio.referencias ?? '',
          telefonoIndicativo: input.envio.telefonoIndicativo,
          telefonoNumero: input.envio.telefonoNumero,
          telefonoCompleto,
          informacionAdicional: input.envio.referencias ?? '',
        },
        notas: input.notas ?? null,
        compradorNombre: user.nombre,
        compradorApellido: user.apellido,
        compradorTelefono: telefonoCompleto,
        compradorEmail: user.email,
        origen: 'tienda',
        items: {
          create: prepared.orderItems,
        },
      },
      include: {
        items: {
          select: { id: true, sku: true, nombreProducto: true, cantidad: true, precioUnitario: true, subtotal: true },
        },
      },
    });

    // Online orders reserve inventory for payment; real stock is consumed only
    // after Mercado Pago approves it.
    await reserveInventoryForOrder(tx, createdOrder.id, new Date(Date.now() + RESERVATION_TTL_MS));

    return createdOrder;
  });

  // Purchases and tier are credited only when payment is approved.
  const tierUpgrade: TierUpgradeResult = { upgraded: false, newTier: currentTier, previousTier: currentTier };

  return {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      tierAtPurchase: order.tierAtPurchase,
      descuentoAplicado: Number(order.descuentoAplicado),
      subtotal: Number(order.subtotal),
      total: Number(order.total),
      items: order.items.map((i) => ({
        id: i.id,
        sku: i.sku,
        nombreProducto: i.nombreProducto,
        cantidad: i.cantidad,
        precioUnitario: Number(i.precioUnitario),
        subtotal: Number(i.subtotal),
      })),
      createdAt: order.createdAt.toISOString(),
    },
    tierUpgrade,
  };
}

export async function createManualOrder(adminId: string, input: CreateManualOrderInput) {
  return prisma.$transaction(async (tx) => {
    const prepared = await prepareOrderItems(tx, input.items, 'detal');
    const order = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: null,
        tierAtPurchase: 'detal',
        descuentoAplicado: 0,
        subtotal: prepared.subtotal,
        total: prepared.total,
        direccionEnvio: {
          direccion: input.comprador.direccion,
          ciudad: input.comprador.ciudad,
          informacionAdicional: input.comprador.informacionEntrega || '',
        },
        notas: input.notas || null,
        compradorNombre: input.comprador.nombre,
        compradorApellido: input.comprador.apellido,
        compradorTelefono: input.comprador.telefono,
        compradorEmail: input.comprador.correo ?? null,
        origen: 'whatsapp',
        createdByAdminId: adminId,
        paymentStatus: 'pending',
        paymentProvider: null,
        items: { create: prepared.orderItems },
      },
      include: {
        items: { select: { id: true, sku: true, nombreProducto: true, cantidad: true, precioUnitario: true, subtotal: true } },
      },
    });

    // Manual orders reserve inventory instead of decrementing it, same as
    // online orders — real stock is only consumed once the sale is actually
    // marked as paid (see markOrderPaidManually), so a pedido that never
    // gets paid doesn't lock stock forever.
    await reserveInventoryForOrder(tx, order.id, new Date(Date.now() + MANUAL_RESERVATION_TTL_MS));
    return formatOrder(order);
  });
}

export async function checkAndUpgradeTier(
  userId: string,
  orderTotal: number,
  currentTier: Tier,
): Promise<TierUpgradeResult> {
  let newTier: Tier = currentTier;

  if (orderTotal >= TIER_CONFIG.gran_mayor.minimo) {
    if (currentTier !== 'gran_mayor') {
      newTier = 'gran_mayor';
    }
  } else if (orderTotal >= TIER_CONFIG.por_mayor.minimo) {
    if (currentTier === 'detal') {
      newTier = 'por_mayor';
    }
  }

  if (newTier === currentTier) {
    return { upgraded: false, newTier: currentTier, previousTier: currentTier };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      tier: newTier,
      tierChangedAt: new Date(),
    },
  });

  await prisma.tierChangeLog.create({
    data: {
      userId,
      oldTier: currentTier,
      newTier,
      reason: 'purchase_threshold',
      changedBy: userId,
    },
  });

  return { upgraded: true, newTier, previousTier: currentTier };
}

export async function getOrders(userId: string, query: Record<string, unknown>) {
  await releaseExpiredReservations(25);
  const { page, pageSize } = parsePagination(query);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      select: {
        id: true, orderNumber: true, status: true, tierAtPurchase: true,
        descuentoAplicado: true, subtotal: true, total: true, notas: true,
        compradorNombre: true, compradorApellido: true, compradorTelefono: true, compradorEmail: true,
        direccionEnvio: true, origen: true, createdByAdminId: true,
        paymentStatus: true, paymentProvider: true, paidAt: true, inventoryReservation: true,
        createdAt: true, updatedAt: true,
        items: {
          select: { id: true, sku: true, nombreProducto: true, cantidad: true, precioUnitario: true, subtotal: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where: { userId } }),
  ]);

  const data = orders.map((o) => formatOrder(o));
  return { data, meta: buildMeta(page, pageSize, total) };
}

export async function getOrderById(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: {
        select: { id: true, sku: true, nombreProducto: true, cantidad: true, precioUnitario: true, subtotal: true },
      },
    },
  });

  if (!order) return null;
  return formatOrder(order);
}

export async function getAdminOrders(query: Record<string, unknown>, statusFilter?: string) {
  const { page, pageSize } = parsePagination(query);

  const where: Record<string, unknown> = {};
  if (statusFilter) {
    where.status = statusFilter;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true, orderNumber: true, status: true, tierAtPurchase: true,
        descuentoAplicado: true, subtotal: true, total: true, notas: true,
        compradorNombre: true, compradorApellido: true, compradorTelefono: true, compradorEmail: true,
        direccionEnvio: true, origen: true, createdByAdminId: true,
        paymentStatus: true, paymentProvider: true, paidAt: true,
        paymentMarkedPaidBy: true,
        paymentMarkedPaidByAdmin: { select: { nombre: true, apellido: true } },
        createdAt: true, updatedAt: true,
        user: { select: { id: true, email: true, nombre: true, apellido: true, tier: true } },
        items: {
          select: { id: true, sku: true, nombreProducto: true, cantidad: true, precioUnitario: true, subtotal: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  const data = orders.map((o) => ({
    ...formatOrder(o),
    user: o.user,
  }));

  return { data, meta: buildMeta(page, pageSize, total) };
}

export async function getAdminOrderById(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { id: true, email: true, nombre: true, apellido: true, tier: true } },
      paymentMarkedPaidByAdmin: { select: { nombre: true, apellido: true } },
      items: {
        select: { id: true, sku: true, nombreProducto: true, cantidad: true, precioUnitario: true, subtotal: true },
      },
    },
  });

  if (!order) return null;
  return { ...formatOrder(order), user: order.user };
}

export async function updateOrderStatus(orderId: string, status: string) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM orders WHERE id = $1::uuid FOR UPDATE`,
      orderId,
    );
    if (locked.length === 0) return null;

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { select: { productId: true, cantidad: true } } },
    });
    if (!order) return null;

    // The generic status endpoint must never be usable to confirm a pedido
    // whose payment isn't approved — that guarantee has to hold regardless of
    // which caller/UI hits this function, not just the dedicated confirm flow.
    // (Already-confirmed orders are left alone: re-sending status='confirmed'
    // for an order that's already confirmed is a harmless no-op here, same
    // as it was before this guard existed.)
    if (status === 'confirmed' && order.status !== 'confirmed' && order.paymentStatus !== 'approved') {
      throw new OrderError('PAYMENT_NOT_APPROVED', 'No se puede confirmar un pedido sin pago aprobado.');
    }

    const updateData: Record<string, unknown> = { status };
    if (status === 'shipped') updateData.shippedAt = new Date();
    if (status === 'delivered') updateData.deliveredAt = new Date();

    // All orders (tienda and whatsapp alike) reserve inventory instead of
    // decrementing it up front, so cancelling any of them goes through the
    // same release-or-refund-reservation path regardless of origen.
    if (status === 'cancelled' && order.status !== 'cancelled') {
      await cancelOnlineOrderInventory(tx, orderId, new Date());
    }

    return tx.order.update({
      where: { id: orderId },
      data: updateData,
    });
  });
}

export type PaymentMethod = 'online' | 'whatsapp';

// The payment method is derived from whether a Mercado Pago preference was
// ever created for this order — not from `origen` (who created it). A
// customer checkout order (origen='tienda') can itself choose to pay via
// WhatsApp instead of Mercado Pago, in which case no preference is ever
// created and paymentProvider stays null, same as an admin-created WhatsApp
// order. Once a Mercado Pago preference exists, the order is committed to
// the online flow and must only be approved via the webhook/reconciliation
// path — never by an admin click.
export function getOrderPaymentMethod(order: { paymentProvider: string | null }): PaymentMethod {
  return order.paymentProvider === 'mercadopago' ? 'online' : 'whatsapp';
}

export type ManualPaymentDecision = 'mark_paid' | 'already_paid' | 'not_manual_order';

// Pure decision function — mirrors evaluateOrderConfirmation below.
export function evaluateManualPayment(order: { paymentProvider: string | null; paymentStatus: string | null }): ManualPaymentDecision {
  if (getOrderPaymentMethod(order) !== 'whatsapp') return 'not_manual_order';
  if (order.paymentStatus === 'approved') return 'already_paid';
  return 'mark_paid';
}

export type MarkOrderPaidResult =
  | { outcome: 'not_found' }
  | { outcome: 'not_manual_order' }
  | { outcome: 'insufficient_stock'; unavailable: Array<{ productId: string; sku: string; nombre: string; requested: number; available: number }> }
  | { outcome: 'paid' | 'already_paid'; order: { id: string; orderNumber: string; status: string; paymentStatus: string | null } };

// Admin-only, idempotent. Records that a WhatsApp/cash sale was paid outside
// the platform — never touches `status`, so confirming the pedido is still a
// separate, explicit action via confirmOrder(). Tracks which admin confirmed
// it and when (paidAt).
export async function markOrderPaidManually(orderId: string, markedPaidBy: string): Promise<MarkOrderPaidResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM orders WHERE id = $1::uuid FOR UPDATE`,
        orderId,
      );
      if (locked.length === 0) return { outcome: 'not_found' };

      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, orderNumber: true, status: true, paymentStatus: true, paymentProvider: true },
      });
      if (!order) return { outcome: 'not_found' };

      const decision = evaluateManualPayment(order);

      if (decision === 'not_manual_order') return { outcome: 'not_manual_order' };
      if (decision === 'already_paid') return { outcome: 'already_paid', order };

      // Consume the reservation (decrementing real stock) before recording
      // the payment — if inventory ran out while this pedido sat unpaid, the
      // whole transaction rolls back and the payment is NOT recorded, so the
      // admin sees the failure instead of a payment marked "paid" that can't
      // actually be fulfilled.
      await consumeReservationForManualPayment(tx, orderId, new Date());

      // paymentProvider is left untouched (null): the PaymentProvider enum only
      // has 'mercadopago' today, and this payment didn't go through Mercado
      // Pago — paymentStatus + paidAt are what the UI needs to show "pagado".
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'approved', paidAt: new Date(), paymentMarkedPaidBy: markedPaidBy },
        select: { id: true, orderNumber: true, status: true, paymentStatus: true },
      });

      return { outcome: 'paid', order: updated };
    });
  } catch (err) {
    if (err instanceof InventoryReservationError && err.code === 'INSUFFICIENT_STOCK') {
      return { outcome: 'insufficient_stock', unavailable: err.unavailable };
    }
    throw err;
  }
}

export type OrderConfirmationDecision = 'confirm' | 'already_confirmed' | 'invalid_status' | 'payment_not_approved';

// Pure decision function for manual order confirmation — no DB, no side
// effects, safe to unit test directly. Kept in sync with the one real
// enforcement point in confirmOrder() below.
export function evaluateOrderConfirmation(order: { status: string; paymentStatus: string | null }): OrderConfirmationDecision {
  if (order.status === 'confirmed') return 'already_confirmed';
  if (order.status !== 'pending') return 'invalid_status';
  if (order.paymentStatus !== 'approved') return 'payment_not_approved';
  return 'confirm';
}

export type ConfirmOrderResult =
  | { outcome: 'not_found' }
  | { outcome: 'payment_not_approved' }
  | { outcome: 'invalid_status' }
  | { outcome: 'confirmed' | 'already_confirmed'; order: { id: string; orderNumber: string; status: string; paymentStatus: string | null } };

// Manual, admin-only order confirmation. Deliberately separate from
// updateOrderStatus: this is the ONLY path allowed to move a pedido from
// "pendiente de confirmación" to "confirmado", it only ever touches `status`
// (never payment fields), and it's idempotent — confirming an already
// confirmed order is a no-op success, not an error.
export async function confirmOrder(orderId: string): Promise<ConfirmOrderResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM orders WHERE id = $1::uuid FOR UPDATE`,
      orderId,
    );
    if (locked.length === 0) return { outcome: 'not_found' };

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, status: true, paymentStatus: true },
    });
    if (!order) return { outcome: 'not_found' };

    const decision = evaluateOrderConfirmation(order);

    if (decision === 'already_confirmed') {
      return { outcome: 'already_confirmed', order };
    }
    if (decision === 'invalid_status') {
      return { outcome: 'invalid_status' };
    }
    if (decision === 'payment_not_approved') {
      return { outcome: 'payment_not_approved' };
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: 'confirmed' },
      select: { id: true, orderNumber: true, status: true, paymentStatus: true },
    });

    return { outcome: 'confirmed', order: updated };
  });
}

function formatOrder(order: {
  id: string;
  orderNumber: string;
  status: string;
  tierAtPurchase: string;
  descuentoAplicado: { toNumber(): number } | number;
  subtotal: { toNumber(): number } | number;
  total: { toNumber(): number } | number;
  notas: string | null;
  compradorNombre?: string;
  compradorApellido?: string;
  compradorTelefono?: string;
  compradorEmail?: string | null;
  direccionEnvio?: unknown;
  origen?: string;
  createdByAdminId?: string | null;
  paymentStatus?: string | null;
  paymentProvider?: string | null;
  paidAt?: Date | null;
  paymentMarkedPaidBy?: string | null;
  paymentMarkedPaidByAdmin?: { nombre: string; apellido: string } | null;
  inventoryReservation?: { status: string; expiresAt: Date } | null;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    sku: string;
    nombreProducto: string;
    cantidad: number;
    precioUnitario: { toNumber(): number } | number;
    subtotal: { toNumber(): number } | number;
  }>;
}) {
  const toNum = (v: { toNumber(): number } | number) => typeof v === 'number' ? v : v.toNumber();

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    tierAtPurchase: order.tierAtPurchase,
    descuentoAplicado: toNum(order.descuentoAplicado),
    subtotal: toNum(order.subtotal),
    total: toNum(order.total),
    notas: order.notas,
    comprador: order.compradorNombre ? {
      nombre: order.compradorNombre,
      apellido: order.compradorApellido ?? '',
      telefono: order.compradorTelefono ?? '',
      correo: order.compradorEmail ?? null,
    } : null,
    direccionEnvio: order.direccionEnvio ?? null,
    origen: order.origen ?? 'tienda',
    createdByAdminId: order.createdByAdminId ?? null,
    paymentStatus: order.paymentStatus ?? null,
    paymentProvider: order.paymentProvider ?? null,
    metodoPago: getOrderPaymentMethod({ paymentProvider: order.paymentProvider ?? null }),
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    paymentMarkedPaidByAdmin: order.paymentMarkedPaidByAdmin
      ? `${order.paymentMarkedPaidByAdmin.nombre} ${order.paymentMarkedPaidByAdmin.apellido}`.trim()
      : null,
    reservationStatus: order.inventoryReservation?.status ?? null,
    reservationExpiresAt: order.inventoryReservation?.expiresAt.toISOString() ?? null,
    retryable: order.origen !== 'whatsapp' && order.paymentStatus !== 'approved' && order.status !== 'confirmed',
    items: order.items.map((i) => ({
      id: i.id,
      sku: i.sku,
      nombreProducto: i.nombreProducto,
      cantidad: i.cantidad,
      precioUnitario: toNum(i.precioUnitario),
      subtotal: toNum(i.subtotal),
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export class OrderError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
