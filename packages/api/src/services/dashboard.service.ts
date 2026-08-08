import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { buildRange, pctDelta, toNumber, CONFIRMED_STATUSES } from './dashboard.utils.js';

const confirmedList = Prisma.join([...CONFIRMED_STATUSES]);

type RawRow = Record<string, unknown>;

interface ProductRow {
  productId: unknown;
  sku: unknown;
  nombre: unknown;
  stock: unknown;
  imagenes: unknown;
  totalSold: unknown;
  averageDaily: unknown;
  daysOfInventory: unknown;
  totalRevenue: unknown;
  averageDailyRevenue: unknown;
}

const mapProductRow = (p: ProductRow) => ({
  productId: p.productId,
  sku: p.sku,
  nombre: p.nombre,
  stock: p.stock,
  imagenes: p.imagenes,
  totalSold: p.totalSold,
  averageDaily: toNumber(p.averageDaily),
  daysOfInventory: p.daysOfInventory,
  totalRevenue: toNumber(p.totalRevenue),
  averageDailyRevenue: toNumber(p.averageDailyRevenue),
});

export async function getDashboardData(days = 30) {
  const { start, prevStart, prevEnd, days: rangeDays } = buildRange(days);

  const productSalesWindow = Prisma.sql`
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    WHERE o.status::text IN (${confirmedList})
      AND o.created_at >= ${start}
      AND oi.sku NOT LIKE 'ACD-%'
  `;

  // Ronda 1 (6 concurrentes): inventario, clientes, resumen, estados, timeline, tiers
  const [inventoryRaw, customerRaw, summaryRaw, statusRaw, revenueTimelineRaw, revenueByTierRaw] = await Promise.all([
    prisma.$queryRaw<Array<RawRow>>`
      SELECT
        (SELECT COUNT(*)::int FROM products WHERE is_active = true) AS "totalActiveProducts",
        (SELECT COUNT(*)::int FROM products WHERE is_active = true AND stock = 0) AS "outOfStock",
        (SELECT COUNT(*)::int FROM products WHERE is_active = true AND stock > 0 AND stock_minimo > 0 AND stock <= stock_minimo) AS "lowStock",
        (SELECT COALESCE(SUM(stock), 0)::int FROM products WHERE is_active = true) AS "totalUnits",
        (SELECT COALESCE(SUM(stock_reservado), 0)::int FROM products WHERE is_active = true) AS "totalReserved",
        (SELECT COALESCE(SUM(precio_base), 0) FROM products WHERE is_active = true) AS "inventoryValue"
    `,
    prisma.$queryRaw<Array<RawRow>>`
      SELECT
        (SELECT COUNT(*)::int FROM users WHERE role::text = 'cliente') AS "total",
        (SELECT COUNT(*)::int FROM users WHERE role::text = 'cliente' AND created_at >= ${start}) AS "newInRange",
        (SELECT COUNT(DISTINCT o.user_id)::int FROM orders o WHERE o.status::text IN (${confirmedList}) AND o.created_at >= ${start}) AS "activeInRange"
    `,
    prisma.$queryRaw<Array<{ revenue: unknown; prevRevenue: unknown; orders: number; prevOrders: number; aov: unknown; prevAov: unknown }>>`
      SELECT
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status::text IN (${confirmedList}) AND created_at >= ${start}) AS "revenue",
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status::text IN (${confirmedList}) AND created_at >= ${prevStart} AND created_at < ${prevEnd}) AS "prevRevenue",
        (SELECT COUNT(*)::int FROM orders WHERE status::text IN (${confirmedList}) AND created_at >= ${start}) AS "orders",
        (SELECT COUNT(*)::int FROM orders WHERE status::text IN (${confirmedList}) AND created_at >= ${prevStart} AND created_at < ${prevEnd}) AS "prevOrders",
        (SELECT COALESCE(AVG(total), 0) FROM orders WHERE status::text IN (${confirmedList}) AND created_at >= ${start}) AS "aov",
        (SELECT COALESCE(AVG(total), 0) FROM orders WHERE status::text IN (${confirmedList}) AND created_at >= ${prevStart} AND created_at < ${prevEnd}) AS "prevAov"
    `,
    prisma.$queryRaw<Array<{ status: string; count: number }>>`
      SELECT status, COUNT(*)::int AS "count"
      FROM orders
      WHERE created_at >= ${start}
      GROUP BY status
    `,
    prisma.$queryRaw<Array<{ date: unknown; revenue: unknown; orders: number }>>`
      WITH series AS (
        SELECT generate_series(${start}::timestamptz, NOW()::timestamptz, interval '1 day')::date AS day
      )
      SELECT s.day AS "date",
        COALESCE(SUM(o.total), 0) AS "revenue",
        COUNT(o.id)::int AS "orders"
      FROM series s
      LEFT JOIN orders o ON o.created_at::date = s.day AND o.status::text IN (${confirmedList})
      GROUP BY s.day
      ORDER BY s.day ASC
    `,
    prisma.$queryRaw<Array<RawRow>>`
      SELECT o.tier_at_purchase::text AS "tier",
        COALESCE(SUM(o.total), 0) AS "revenue",
        COUNT(o.id)::int AS "orders",
        COALESCE(AVG(o.total), 0) AS "aov",
        COALESCE(SUM(o.subtotal - o.total), 0) AS "discount"
      FROM orders o
      WHERE o.status::text IN (${confirmedList}) AND o.created_at >= ${start}
      GROUP BY o.tier_at_purchase
      ORDER BY "revenue" DESC
    `,
  ]);

  // Ronda 2 (6 concurrentes): categorías, clientes top, cambios de tier, productos, reposición, lento movimiento
  const [salesByCategoryRaw, topCustomersRaw, tierUpgradesRaw, topProductsRaw, restockAlertsRaw, slowMoversRaw] = await Promise.all([
    prisma.$queryRaw<Array<RawRow>>`
      SELECT c.nombre AS "category",
        SUM(oi.cantidad)::int AS "units",
        COALESCE(SUM(oi.cantidad * oi.precio_unitario), 0) AS "revenue"
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      WHERE o.status::text IN (${confirmedList}) AND o.created_at >= ${start}
        AND oi.sku NOT LIKE 'ACD-%'
      GROUP BY c.nombre
      ORDER BY "revenue" DESC
      LIMIT 8
    `,
    prisma.$queryRaw<Array<RawRow>>`
      SELECT u.id, u.nombre, u.apellido, u.email, u.tier::text AS "tier",
        COUNT(o.id)::int AS "orders",
        COALESCE(SUM(o.total), 0) AS "total",
        MAX(o.created_at)::date AS "lastOrderAt"
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.status::text IN (${confirmedList}) AND o.created_at >= ${start}
      GROUP BY u.id, u.nombre, u.apellido, u.email, u.tier
      ORDER BY "total" DESC
      LIMIT 10
    `,
    prisma.$queryRaw<Array<RawRow>>`
      SELECT u.email, u.nombre, u.apellido, t.old_tier::text AS "oldTier", t.new_tier::text AS "newTier", t.created_at AS "createdAt"
      FROM tier_change_log t
      JOIN users u ON t.user_id = u.id
      WHERE t.created_at >= ${start}
      ORDER BY t.created_at DESC
      LIMIT 20
    `,
    prisma.$queryRaw<Array<ProductRow>>`
      SELECT oi.product_id AS "productId", p.sku, p.nombre, p.stock, p.imagenes,
        SUM(oi.cantidad)::int AS "totalSold",
        ROUND(SUM(oi.cantidad)::numeric / ${rangeDays}, 2) AS "averageDaily",
        CASE
          WHEN SUM(oi.cantidad) = 0 THEN NULL
          ELSE ROUND(p.stock::numeric / (SUM(oi.cantidad)::numeric / ${rangeDays}), 0)::int
        END AS "daysOfInventory",
        ROUND(SUM(oi.cantidad * oi.precio_unitario)::numeric, 0)::int AS "totalRevenue",
        ROUND(SUM(oi.cantidad * oi.precio_unitario)::numeric / ${rangeDays}, 0)::int AS "averageDailyRevenue"
      ${productSalesWindow}
      GROUP BY oi.product_id, p.sku, p.nombre, p.stock, p.imagenes
      ORDER BY "totalSold" DESC
      LIMIT 10
    `,
    prisma.$queryRaw<Array<ProductRow>>`
      SELECT sub."productId", sub.sku, sub.nombre, sub.stock, sub.imagenes,
        sub."totalSold", sub."averageDaily", sub."daysOfInventory", sub."totalRevenue", sub."averageDailyRevenue"
      FROM (
        SELECT oi.product_id AS "productId", p.sku, p.nombre, p.stock, p.imagenes,
          SUM(oi.cantidad)::int AS "totalSold",
          ROUND(SUM(oi.cantidad)::numeric / ${rangeDays}, 2) AS "averageDaily",
          CASE
            WHEN SUM(oi.cantidad) = 0 THEN NULL
            ELSE ROUND(p.stock::numeric / (SUM(oi.cantidad)::numeric / ${rangeDays}), 0)::int
          END AS "daysOfInventory",
          ROUND(SUM(oi.cantidad * oi.precio_unitario)::numeric, 0)::int AS "totalRevenue",
          ROUND(SUM(oi.cantidad * oi.precio_unitario)::numeric / ${rangeDays}, 0)::int AS "averageDailyRevenue"
        ${productSalesWindow}
        GROUP BY oi.product_id, p.sku, p.nombre, p.stock, p.imagenes
      ) sub
      WHERE sub."daysOfInventory" IS NOT NULL AND sub."daysOfInventory" < 7
      ORDER BY sub."daysOfInventory" ASC
    `,
    prisma.$queryRaw<Array<RawRow>>`
      SELECT p.id AS "productId", p.sku, p.nombre, p.stock, p.stock_minimo AS "stockMinimo", c.nombre AS "category"
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true AND p.stock > 0 AND p.sku NOT LIKE 'ACD-%'
        AND NOT EXISTS (
          SELECT 1 FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE oi.product_id = p.id
            AND o.status::text IN (${confirmedList})
            AND o.created_at >= NOW() - INTERVAL '30 days'
        )
      ORDER BY p.stock DESC
      LIMIT 10
    `,
  ]);

  // Ronda 3 (2 concurrentes): inventario por producto + órdenes recientes
  const [stockListRaw, recentOrders] = await Promise.all([
    prisma.$queryRaw<Array<RawRow>>`
      SELECT id, sku, nombre, imagenes, stock, stock_minimo AS "stockMinimo",
        CASE
          WHEN stock = 0 THEN 'out'
          WHEN stock_minimo > 0 AND stock <= stock_minimo THEN 'low'
          ELSE 'ok'
        END AS "status"
      FROM products
      WHERE is_active = true
      ORDER BY (CASE WHEN stock = 0 THEN 0 WHEN stock_minimo > 0 AND stock <= stock_minimo THEN 1 ELSE 2 END), stock DESC, nombre ASC
    `,
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      where: { createdAt: { gte: start }, status: { not: 'cancelled' } },
      include: {
        user: { select: { nombre: true, apellido: true } },
      },
    }),
  ]);

  const mapStockItem = (p: RawRow) => ({
    id: String(p.id),
    sku: String(p.sku),
    nombre: String(p.nombre),
    imagenes: Array.isArray(p.imagenes) ? (p.imagenes as string[]) : [],
    stock: toNumber(p.stock),
    stockMinimo: toNumber(p.stockMinimo),
  });

  const stockList = stockListRaw as RawRow[];
  const outOfStockProducts = stockList.filter((p) => p.status === 'out').slice(0, 6).map(mapStockItem);
  const lowStockProducts = stockList.filter((p) => p.status === 'low').slice(0, 6).map(mapStockItem);
  const healthyProducts = stockList.filter((p) => p.status === 'ok').slice(0, 5).map(mapStockItem);

  const inv = inventoryRaw[0];
  const cust = customerRaw[0];
  const totalActiveProducts = toNumber(inv.totalActiveProducts);
  const outOfStock = toNumber(inv.outOfStock);
  const lowStock = toNumber(inv.lowStock);
  const totalUnits = toNumber(inv.totalUnits);
  const totalReserved = toNumber(inv.totalReserved);
  const inventoryValue = toNumber(inv.inventoryValue);

  const customerCount = toNumber(cust.total);
  const newCustomers = toNumber(cust.newInRange);
  const activeInRange = toNumber(cust.activeInRange);

  const statusMap: Record<string, number> = {};
  for (const row of statusRaw) {
    statusMap[row.status] = row.count;
  }

  const confirmedOrders = CONFIRMED_STATUSES.reduce((acc, s) => acc + (statusMap[s] ?? 0), 0);

  const s = summaryRaw[0];
  const revenue = toNumber(s.revenue);
  const revenuePrev = toNumber(s.prevRevenue);
  const orders = toNumber(s.orders);
  const ordersPrev = toNumber(s.prevOrders);
  const aov = toNumber(s.aov);
  const aovPrev = toNumber(s.prevAov);

  return {
    range: {
      days: rangeDays,
      start: start.toISOString(),
      prevStart: prevStart.toISOString(),
      prevEnd: prevEnd.toISOString(),
    },
    summary: {
      revenue,
      revenuePrev,
      revenueDeltaPct: pctDelta(revenue, revenuePrev),
      orders,
      ordersPrev,
      ordersDeltaPct: pctDelta(orders, ordersPrev),
      aov,
      aovPrev,
      aovDeltaPct: pctDelta(aov, aovPrev),
      pendingOrders: statusMap.pending ?? 0,
      confirmedOrders,
    },
    inventory: {
      totalActiveProducts,
      outOfStock,
      lowStock,
      totalUnits,
      totalReserved,
      inventoryValue,
      outOfStockProducts,
      lowStockProducts,
      healthyProducts,
    },
    customers: {
      total: customerCount,
      newInRange: newCustomers,
      activeInRange,
    },
    topProducts: (topProductsRaw as ProductRow[]).map(mapProductRow),
    restockAlerts: (restockAlertsRaw as ProductRow[]).map(mapProductRow),
    ordersByStatus: statusMap,
    revenueTimeline: (revenueTimelineRaw as Array<{ date: unknown; revenue: unknown; orders: number }>).map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      revenue: toNumber(r.revenue),
      orders: toNumber(r.orders),
    })),
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: Number(o.total),
      tierAtPurchase: o.tierAtPurchase,
      customerName: o.user
        ? `${o.user.nombre} ${o.user.apellido}`.trim()
        : `${o.compradorNombre} ${o.compradorApellido}`.trim(),
      createdAt: o.createdAt.toISOString(),
    })),
    revenueByTier: (revenueByTierRaw as RawRow[]).map((r) => ({
      tier: String(r.tier),
      revenue: toNumber(r.revenue),
      orders: toNumber(r.orders),
      aov: toNumber(r.aov),
      discount: toNumber(r.discount),
    })),
    salesByCategory: (salesByCategoryRaw as RawRow[]).map((r) => ({
      category: String(r.category),
      units: toNumber(r.units),
      revenue: toNumber(r.revenue),
    })),
    topCustomers: (topCustomersRaw as RawRow[]).map((r) => ({
      id: String(r.id),
      nombre: `${r.nombre ?? ''} ${r.apellido ?? ''}`.trim(),
      email: String(r.email),
      tier: String(r.tier),
      orders: toNumber(r.orders),
      total: toNumber(r.total),
      lastOrderAt: r.lastOrderAt instanceof Date ? r.lastOrderAt.toISOString().split('T')[0] : String(r.lastOrderAt ?? ''),
    })),
    tierUpgrades: (tierUpgradesRaw as RawRow[]).map((r) => ({
      email: String(r.email),
      nombre: `${r.nombre ?? ''} ${r.apellido ?? ''}`.trim(),
      oldTier: String(r.oldTier),
      newTier: String(r.newTier),
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })),
    slowMovers: (slowMoversRaw as RawRow[]).map((r) => ({
      productId: String(r.productId),
      sku: String(r.sku),
      nombre: String(r.nombre),
      stock: toNumber(r.stock),
      stockMinimo: toNumber(r.stockMinimo),
      category: String(r.category),
    })),
  };
}
