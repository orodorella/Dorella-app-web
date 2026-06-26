import type { Tier } from 'shared/src/types/user.js';
import { TIER_CONFIG } from 'shared/src/constants/tiers.js';
import { prisma } from '../config/db.js';
import { calculatePrice } from './pricing.service.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';
import type { CreateOrderInput } from '../validators/order.schema.js';

function generateOrderNumber(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `DOR-${y}${m}${d}-${rand}`;
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
    const productIds = input.items.map((i) => i.productId);

    // SELECT FOR UPDATE to lock rows
    await tx.$queryRawUnsafe(
      `SELECT id FROM products WHERE id = ANY($1::uuid[]) FOR UPDATE`,
      productIds,
    );

    const products = await tx.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, sku: true, nombre: true, precioBase: true, stock: true, stockReservado: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    let total = 0;
    const orderItemsData: Array<{
      productId: string;
      sku: string;
      nombreProducto: string;
      cantidad: number;
      precioUnitario: number;
      precioBaseSnapshot: number;
      subtotal: number;
    }> = [];

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new OrderError('PRODUCT_NOT_FOUND', `Producto ${item.productId} no encontrado`);
      }

      const disponible = product.stock - product.stockReservado;
      if (disponible < item.cantidad) {
        throw new OrderError('INSUFFICIENT_STOCK', `Stock insuficiente para ${product.nombre}. Disponible: ${disponible}`);
      }

      const precioBase = Number(product.precioBase);
      const precioUnitario = calculatePrice(precioBase, currentTier);
      const lineSubtotal = precioUnitario * item.cantidad;

      subtotal += precioBase * item.cantidad;
      total += lineSubtotal;

      orderItemsData.push({
        productId: product.id,
        sku: product.sku,
        nombreProducto: product.nombre,
        cantidad: item.cantidad,
        precioUnitario,
        precioBaseSnapshot: precioBase,
        subtotal: lineSubtotal,
      });
    }

    const orderNumber = generateOrderNumber();

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { direccion: true, ciudad: true, departamento: true },
    });

    const createdOrder = await tx.order.create({
      data: {
        orderNumber,
        userId,
        tierAtPurchase: currentTier,
        descuentoAplicado: descuento,
        subtotal,
        total,
        direccionEnvio: {
          direccion: user?.direccion ?? '',
          ciudad: user?.ciudad ?? '',
          departamento: user?.departamento ?? '',
        },
        notas: input.notas ?? null,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: {
          select: { id: true, sku: true, nombreProducto: true, cantidad: true, precioUnitario: true, subtotal: true },
        },
      },
    });

    // Deduct stock
    for (const item of input.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.cantidad } },
      });
    }

    // Update user accumulated purchases
    await tx.user.update({
      where: { id: userId },
      data: { totalComprasAcumulado: { increment: total } },
    });

    return createdOrder;
  });

  // Tier upgrade check AFTER transaction commits
  const tierUpgrade = await checkAndUpgradeTier(userId, Number(order.total), currentTier);

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
  const { page, pageSize } = parsePagination(query);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      include: {
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
      include: {
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
      items: {
        select: { id: true, sku: true, nombreProducto: true, cantidad: true, precioUnitario: true, subtotal: true },
      },
    },
  });

  if (!order) return null;
  return { ...formatOrder(order), user: order.user };
}

export async function updateOrderStatus(orderId: string, status: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;

  const updateData: Record<string, unknown> = { status };
  if (status === 'shipped') updateData.shippedAt = new Date();
  if (status === 'delivered') updateData.deliveredAt = new Date();

  return prisma.order.update({
    where: { id: orderId },
    data: updateData,
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
