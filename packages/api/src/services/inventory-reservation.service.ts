import type { Prisma } from '@prisma/client';
import { TIER_CONFIG } from 'shared/src/constants/tiers.js';
import type { Tier } from 'shared/src/types/user.js';
import { prisma } from '../config/db.js';

export const RESERVATION_TTL_MS = 30 * 60 * 1000;

export class InventoryReservationError extends Error {
  constructor(public code: string, message: string, public unavailable: Array<{ productId: string; sku: string; nombre: string; requested: number; available: number }> = []) {
    super(message);
  }
}

async function lockProducts(tx: Prisma.TransactionClient, productIds: string[]) {
  const ids = [...new Set(productIds)].sort();
  await tx.$queryRawUnsafe(`SELECT id FROM products WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`, ids);
}

export async function reserveInventoryForOrder(tx: Prisma.TransactionClient, orderId: string, expiresAt: Date) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { items: { select: { productId: true, sku: true, nombreProducto: true, cantidad: true } } },
  });
  if (!order) throw new InventoryReservationError('ORDER_NOT_FOUND', 'Pedido no encontrado.');
  await lockProducts(tx, order.items.map((item) => item.productId));
  const products = await tx.product.findMany({
    where: { id: { in: order.items.map((item) => item.productId) }, isActive: true },
    select: { id: true, stock: true, stockReservado: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const unavailable = order.items.flatMap((item) => {
    const product = byId.get(item.productId);
    const available = product ? product.stock - product.stockReservado : 0;
    return available < item.cantidad ? [{ productId: item.productId, sku: item.sku, nombre: item.nombreProducto, requested: item.cantidad, available }] : [];
  });
  if (unavailable.length) throw new InventoryReservationError('INSUFFICIENT_STOCK', 'Algunos productos ya no tienen inventario suficiente.', unavailable);

  for (const item of order.items) {
    await tx.product.update({ where: { id: item.productId }, data: { stockReservado: { increment: item.cantidad } } });
  }
  await tx.inventoryReservation.upsert({
    where: { orderId },
    create: { orderId, status: 'active', expiresAt },
    update: { status: 'active', expiresAt, consumedAt: null, releasedAt: null },
  });
}

export async function ensureActiveReservation(orderId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(`SELECT id FROM orders WHERE id = $1::uuid FOR UPDATE`, orderId);
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true, status: true, paymentStatus: true, paidAt: true, inventoryReservation: true },
    });
    if (!order) throw new InventoryReservationError('ORDER_NOT_FOUND', 'Pedido no encontrado.');
    if (order.paymentStatus === 'approved' || order.paidAt || order.status === 'confirmed') {
      throw new InventoryReservationError('ORDER_ALREADY_PAID', 'Este pedido ya tiene un pago aprobado.');
    }
    const now = new Date();
    if (order.inventoryReservation?.status === 'active' && order.inventoryReservation.expiresAt > now) return order.inventoryReservation.expiresAt;
    if (order.inventoryReservation?.status === 'active') await releaseReservationInTransaction(tx, orderId, now);
    const expiresAt = new Date(now.getTime() + RESERVATION_TTL_MS);
    await reserveInventoryForOrder(tx, orderId, expiresAt);
    if (order.status === 'cancelled') await tx.order.update({ where: { id: orderId }, data: { status: 'pending' } });
    return expiresAt;
  });
}

export async function releaseReservationInTransaction(tx: Prisma.TransactionClient, orderId: string, now: Date) {
  const reservation = await tx.inventoryReservation.findUnique({ where: { orderId } });
  if (!reservation || reservation.status !== 'active') return false;
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { items: { select: { productId: true, cantidad: true } } } });
  if (!order) return false;
  await lockProducts(tx, order.items.map((item) => item.productId));
  for (const item of order.items) {
    await tx.product.update({ where: { id: item.productId }, data: { stockReservado: { decrement: item.cantidad } } });
  }
  await tx.inventoryReservation.update({ where: { orderId }, data: { status: 'released', releasedAt: now } });
  return true;
}

export async function cancelOnlineOrderInventory(tx: Prisma.TransactionClient, orderId: string, now: Date) {
  const reservation = await tx.inventoryReservation.findUnique({ where: { orderId } });
  if (!reservation || reservation.status === 'released') return false;
  if (reservation.status === 'active') return releaseReservationInTransaction(tx, orderId, now);
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { items: { select: { productId: true, cantidad: true } } } });
  if (!order) return false;
  await lockProducts(tx, order.items.map((item) => item.productId));
  for (const item of order.items) {
    await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.cantidad } } });
  }
  await tx.inventoryReservation.update({ where: { orderId }, data: { status: 'released', releasedAt: now } });
  return true;
}

export async function releaseOrderReservation(orderId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(`SELECT id FROM orders WHERE id = $1::uuid FOR UPDATE`, orderId);
    return releaseReservationInTransaction(tx, orderId, new Date());
  });
}

export async function releaseExpiredReservations(limit = 100) {
  const expired = await prisma.inventoryReservation.findMany({ where: { status: 'active', expiresAt: { lte: new Date() } }, select: { orderId: true }, take: limit });
  let released = 0;
  for (const { orderId } of expired) if (await releaseOrderReservation(orderId)) released++;
  return released;
}

function tierForAccumulated(total: number): Tier {
  if (total >= TIER_CONFIG.gran_mayor.minimo) return 'gran_mayor';
  if (total >= TIER_CONFIG.por_mayor.minimo) return 'por_mayor';
  return 'detal';
}

export async function consumeReservationAndCreditPurchase(tx: Prisma.TransactionClient, orderId: string, now: Date) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { userId: true, total: true, purchaseCreditedAt: true, inventoryReservation: true, items: { select: { productId: true, cantidad: true } } },
  });
  if (!order || !order.userId) throw new InventoryReservationError('ORDER_NOT_FOUND', 'Pedido no encontrado.');
  if (order.inventoryReservation?.status !== 'active' || order.inventoryReservation.expiresAt <= now) {
    if (order.inventoryReservation?.status === 'active') await releaseReservationInTransaction(tx, orderId, now);
    // A webhook may arrive after the reservation cleanup even though Mercado
    // Pago accepted the payment. Reacquire atomically before consuming; if
    // inventory is gone, fail loudly instead of driving stock negative.
    await reserveInventoryForOrder(tx, orderId, new Date(now.getTime() + RESERVATION_TTL_MS));
  }
  await lockProducts(tx, order.items.map((item) => item.productId));
  for (const item of order.items) {
    await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.cantidad }, stockReservado: { decrement: item.cantidad } } });
  }
  await tx.inventoryReservation.update({ where: { orderId }, data: { status: 'consumed', consumedAt: now } });
  if (!order.purchaseCreditedAt) {
    const user = await tx.user.update({ where: { id: order.userId }, data: { totalComprasAcumulado: { increment: order.total } }, select: { tier: true, totalComprasAcumulado: true } });
    const nextTier = tierForAccumulated(Number(user.totalComprasAcumulado));
    if (nextTier !== user.tier) {
      await tx.user.update({ where: { id: order.userId }, data: { tier: nextTier, tierChangedAt: now } });
      await tx.tierChangeLog.create({ data: { userId: order.userId, oldTier: user.tier, newTier: nextTier, reason: 'purchase_threshold', changedBy: order.userId } });
    }
    await tx.order.update({ where: { id: orderId }, data: { purchaseCreditedAt: now } });
  }
}

export function startReservationCleanup() {
  const timer = setInterval(() => void releaseExpiredReservations().catch((error) => console.error('[inventory] reservation cleanup failed', error)), 60_000);
  timer.unref();
}
