import { Prisma, type OrderStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { buildRange, pctDelta, toNumber, CONFIRMED_STATUSES } from './dashboard.utils.js';
import { IN_PROGRESS_ORDER_STATUSES } from 'shared/src/constants/order-status.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';

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

export type DashboardSection = 'core' | 'charts' | 'inventory' | 'extras';
export const ALL_DASHBOARD_SECTIONS: DashboardSection[] = ['core', 'charts', 'inventory', 'extras'];

/**
 * El Dashboard se puede pedir por secciones para que la pantalla muestre lo esencial enseguida:
 * - core: KPIs (ventas, órdenes, ticket), clientes, estado de órdenes y conteos de inventario.
 * - charts: series y gráficos (por modalidad, categoría, productos y clientes top, órdenes recientes).
 * - inventory: listas de productos agotados / por reponer y reabastecimiento prioritario.
 * - extras: vistas previas de cambios de nivel y lento movimiento.
 * Las secciones no pedidas no ejecutan sus consultas y devuelven valores vacíos (misma forma de respuesta).
 */
export async function getDashboardData(days = 30, sections: DashboardSection[] = ALL_DASHBOARD_SECTIONS) {
  const { start, prevStart, prevEnd, days: rangeDays } = buildRange(days);
  const wanted = new Set(sections);
  const want = (section: DashboardSection) => wanted.has(section);
  const off = Promise.resolve([] as never[]);

  const productSalesWindow = Prisma.sql`
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    WHERE o.status = ANY(ARRAY[${confirmedList}]::"OrderStatus"[])
      AND o.created_at >= ${start}
      AND oi.sku NOT LIKE 'ACD-%'
  `;

  // Ronda 1 (6 concurrentes): inventario, clientes, resumen, estados, timeline, tiers
  const [inventoryRaw, customerRaw, summaryRaw, statusRaw, revenueTimelineRaw, revenueByTierRaw] = await Promise.all([
    !want('core') ? off : prisma.$queryRaw<Array<RawRow>>`
      SELECT
        (SELECT COUNT(*)::int FROM products WHERE is_active = true) AS "totalActiveProducts",
        (SELECT COUNT(*)::int FROM products WHERE is_active = true AND stock = 0) AS "outOfStock",
        (SELECT COUNT(*)::int FROM products WHERE is_active = true AND stock > 0 AND stock_minimo > 0 AND stock <= stock_minimo) AS "lowStock",
        (SELECT COALESCE(SUM(stock), 0)::int FROM products WHERE is_active = true) AS "totalUnits",
        (SELECT COALESCE(SUM(stock_reservado), 0)::int FROM products WHERE is_active = true) AS "totalReserved",
        (SELECT COALESCE(SUM(precio_base * stock), 0) FROM products WHERE is_active = true) AS "inventoryValue"
    `,
    !want('core') ? off : prisma.$queryRaw<Array<RawRow>>`
      SELECT
        (SELECT COUNT(*)::int FROM users WHERE role::text = 'cliente') AS "total",
        (SELECT COUNT(*)::int FROM users WHERE role::text = 'cliente' AND created_at >= ${start}) AS "newInRange",
        (SELECT COUNT(DISTINCT o.user_id)::int FROM orders o WHERE o.status = ANY(ARRAY[${confirmedList}]::"OrderStatus"[]) AND o.created_at >= ${start}) AS "activeInRange"
    `,
    !want('core') ? off : prisma.$queryRaw<Array<{ revenue: unknown; prevRevenue: unknown; orders: number; prevOrders: number; aov: unknown; prevAov: unknown }>>`
      SELECT
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = ANY(ARRAY[${confirmedList}]::"OrderStatus"[]) AND created_at >= ${start}) AS "revenue",
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = ANY(ARRAY[${confirmedList}]::"OrderStatus"[]) AND created_at >= ${prevStart} AND created_at < ${prevEnd}) AS "prevRevenue",
        (SELECT COUNT(*)::int FROM orders WHERE status = ANY(ARRAY[${confirmedList}]::"OrderStatus"[]) AND created_at >= ${start}) AS "orders",
        (SELECT COUNT(*)::int FROM orders WHERE status = ANY(ARRAY[${confirmedList}]::"OrderStatus"[]) AND created_at >= ${prevStart} AND created_at < ${prevEnd}) AS "prevOrders",
        (SELECT COALESCE(AVG(total), 0) FROM orders WHERE status = ANY(ARRAY[${confirmedList}]::"OrderStatus"[]) AND created_at >= ${start}) AS "aov",
        (SELECT COALESCE(AVG(total), 0) FROM orders WHERE status = ANY(ARRAY[${confirmedList}]::"OrderStatus"[]) AND created_at >= ${prevStart} AND created_at < ${prevEnd}) AS "prevAov"
    `,
    !want('core') ? off : prisma.$queryRaw<Array<{ status: string; count: number }>>`
      SELECT status, COUNT(*)::int AS "count"
      FROM orders
      WHERE created_at >= ${start}
      GROUP BY status
    `,
    !want('charts') ? off : prisma.$queryRaw<Array<{ date: unknown; revenue: unknown; orders: number }>>`
      WITH series AS (
        SELECT generate_series(${start}::timestamptz, NOW()::timestamptz, interval '1 day')::date AS day
      )
      -- Se agrega una sola vez (con el rango y el estado como enum, que usan el índice) y se une a la serie de días.
      SELECT s.day AS "date",
        COALESCE(a.revenue, 0) AS "revenue",
        COALESCE(a.orders, 0)::int AS "orders"
      FROM series s
      LEFT JOIN (
        SELECT created_at::date AS day, SUM(total) AS revenue, COUNT(*) AS orders
        FROM orders
        WHERE created_at >= ${start}::timestamptz::date AND status = ANY(ARRAY[${confirmedList}]::"OrderStatus"[])
        GROUP BY 1
      ) a ON a.day = s.day
      ORDER BY s.day ASC
    `,
    !want('charts') ? off : prisma.$queryRaw<Array<RawRow>>`
      SELECT o.tier_at_purchase::text AS "tier",
        COALESCE(SUM(o.total), 0) AS "revenue",
        COUNT(o.id)::int AS "orders",
        COALESCE(AVG(o.total), 0) AS "aov",
        COALESCE(SUM(o.subtotal - o.total), 0) AS "discount"
      FROM orders o
      WHERE o.status = ANY(ARRAY[${confirmedList}]::"OrderStatus"[]) AND o.created_at >= ${start}
      GROUP BY o.tier_at_purchase
      ORDER BY "revenue" DESC
    `,
  ]);

  // Ronda 2 (6 concurrentes): categorías, clientes top, cambios de tier, productos, reposición, lento movimiento
  const [salesByCategoryRaw, topCustomersRaw, tierUpgradesRaw, topProductsRaw, restockAlertsRaw, slowMoversRaw] = await Promise.all([
    !want('charts') ? off : prisma.$queryRaw<Array<RawRow>>`
      SELECT c.nombre AS "category",
        SUM(oi.cantidad)::int AS "units",
        COALESCE(SUM(oi.cantidad * oi.precio_unitario), 0) AS "revenue"
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      WHERE o.status = ANY(ARRAY[${confirmedList}]::"OrderStatus"[]) AND o.created_at >= ${start}
        AND oi.sku NOT LIKE 'ACD-%'
      GROUP BY c.nombre
      ORDER BY "revenue" DESC
      LIMIT 8
    `,
    !want('charts') ? off : prisma.$queryRaw<Array<RawRow>>`
      SELECT u.id, u.nombre, u.apellido, u.email, u.tier::text AS "tier",
        COUNT(o.id)::int AS "orders",
        COALESCE(SUM(o.total), 0) AS "total",
        MAX(o.created_at)::date AS "lastOrderAt"
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.status = ANY(ARRAY[${confirmedList}]::"OrderStatus"[]) AND o.created_at >= ${start}
      GROUP BY u.id, u.nombre, u.apellido, u.email, u.tier
      ORDER BY "total" DESC, u.id
      LIMIT 10
    `,
    !want('extras') ? off : prisma.$queryRaw<Array<RawRow>>`
      SELECT u.email, u.nombre, u.apellido, t.old_tier::text AS "oldTier", t.new_tier::text AS "newTier", t.created_at AS "createdAt"
      FROM tier_change_log t
      JOIN users u ON t.user_id = u.id
      WHERE t.created_at >= ${start}
      ORDER BY t.created_at DESC
      LIMIT 20
    `,
    !want('charts') ? off : prisma.$queryRaw<Array<ProductRow>>`
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
    !want('inventory') ? off : prisma.$queryRaw<Array<ProductRow>>`
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
      LIMIT 5
    `,
    !want('extras') ? off : prisma.$queryRaw<Array<RawRow>>`
      SELECT p.id AS "productId", p.sku, p.nombre, p.stock, p.stock_minimo AS "stockMinimo", c.nombre AS "category"
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true AND p.stock > 0 AND p.sku NOT LIKE 'ACD-%'
        AND NOT EXISTS (
          SELECT 1 FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE oi.product_id = p.id
            AND o.status = ANY(ARRAY[${confirmedList}]::"OrderStatus"[])
            AND o.created_at >= NOW() - INTERVAL '30 days'
        )
      ORDER BY p.stock DESC, p.id
      LIMIT 10
    `,
  ]);

  // Ronda 3 (2 concurrentes): inventario por producto + órdenes recientes
  const [stockListRaw, recentOrders] = await Promise.all([
    !want('inventory') ? off : prisma.$queryRaw<Array<RawRow>>`
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
    !want('charts') ? off : prisma.order.findMany({
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

  const inv = inventoryRaw[0] ?? ({} as RawRow);
  const cust = customerRaw[0] ?? ({} as RawRow);
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

  const s = summaryRaw[0] ?? ({} as (typeof summaryRaw)[number]);
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

// Paginated counterpart to the "Lento Movimiento" preview embedded in
// getDashboardData (which stays capped at 10 rows). Same query, same
// "sin ventas en 30 días" definition, just with real page/pageSize instead
// of a hard LIMIT.
export async function getSlowMovers(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);

  const where = Prisma.sql`
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = true AND p.stock > 0 AND p.sku NOT LIKE 'ACD-%'
      AND NOT EXISTS (
        SELECT 1 FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE oi.product_id = p.id
          AND o.status = ANY(ARRAY[${confirmedList}]::"OrderStatus"[])
          AND o.created_at >= NOW() - INTERVAL '30 days'
      )
  `;

  const [rows, totalRaw] = await Promise.all([
    prisma.$queryRaw<Array<RawRow>>`
      SELECT p.id AS "productId", p.sku, p.nombre, p.stock, p.stock_minimo AS "stockMinimo", c.nombre AS "category"
      ${where}
      ORDER BY p.stock DESC, p.id
      OFFSET ${(page - 1) * pageSize} LIMIT ${pageSize}
    `,
    prisma.$queryRaw<Array<{ total: bigint }>>`SELECT COUNT(*)::bigint AS total ${where}`,
  ]);

  const data = rows.map((r) => ({
    productId: String(r.productId),
    sku: String(r.sku),
    nombre: String(r.nombre),
    stock: toNumber(r.stock),
    stockMinimo: toNumber(r.stockMinimo),
    category: String(r.category),
  }));

  return { data, meta: buildMeta(page, pageSize, Number(totalRaw[0]?.total ?? 0)) };
}

// Paginated counterpart to the "Cambios de tier" preview embedded in
// getDashboardData (which stays capped at 20 rows, scoped to the same date
// range as the rest of the summary).
export async function getTierUpgrades(query: Record<string, unknown>, days = 30) {
  const { page, pageSize } = parsePagination(query);
  const { start } = buildRange(days);

  const [rows, totalRaw] = await Promise.all([
    prisma.$queryRaw<Array<RawRow>>`
      SELECT u.email, u.nombre, u.apellido, t.old_tier::text AS "oldTier", t.new_tier::text AS "newTier", t.created_at AS "createdAt"
      FROM tier_change_log t
      JOIN users u ON t.user_id = u.id
      WHERE t.created_at >= ${start}
      ORDER BY t.created_at DESC
      OFFSET ${(page - 1) * pageSize} LIMIT ${pageSize}
    `,
    prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total FROM tier_change_log t WHERE t.created_at >= ${start}
    `,
  ]);

  const data = rows.map((r) => ({
    email: String(r.email),
    nombre: `${r.nombre ?? ''} ${r.apellido ?? ''}`.trim(),
    oldTier: String(r.oldTier),
    newTier: String(r.newTier),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }));

  return { data, meta: buildMeta(page, pageSize, Number(totalRaw[0]?.total ?? 0)) };
}

// Paginated counterpart to the "Reabastecimiento Prioritario" preview
// embedded in getDashboardData (which stays capped at 5 rows). Same
// "less than 7 days of inventory left" definition, scoped to the same date
// range as the rest of the summary.
export async function getRestockAlerts(query: Record<string, unknown>, days = 30) {
  const { page, pageSize } = parsePagination(query);
  const { start, days: rangeDays } = buildRange(days);

  const productSalesWindow = Prisma.sql`
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    WHERE o.status = ANY(ARRAY[${confirmedList}]::"OrderStatus"[])
      AND o.created_at >= ${start}
      AND oi.sku NOT LIKE 'ACD-%'
  `;

  const salesByProduct = Prisma.sql`
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
  `;

  const [rows, totalRaw] = await Promise.all([
    prisma.$queryRaw<Array<ProductRow>>`
      SELECT sub.* FROM (${salesByProduct}) sub
      WHERE sub."daysOfInventory" IS NOT NULL AND sub."daysOfInventory" < 7
      ORDER BY sub."daysOfInventory" ASC
      OFFSET ${(page - 1) * pageSize} LIMIT ${pageSize}
    `,
    prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total FROM (${salesByProduct}) sub
      WHERE sub."daysOfInventory" IS NOT NULL AND sub."daysOfInventory" < 7
    `,
  ]);

  return { data: rows.map(mapProductRow), meta: buildMeta(page, pageSize, Number(totalRaw[0]?.total ?? 0)) };
}

/**
 * Resumen operativo para bodega: sin ingresos, valor de inventario ni datos de
 * clientes. Solo conteos de stock y de pedidos por estado.
 *
 * "Por preparar" = pedidos ya pagados (payment_status approved) en estado
 * Confirmado, los más antiguos primero — eso es exactamente lo que bodega
 * tiene que empacar a continuación. La lista se limita a `previewLimit`
 * (con el total real aparte, para el "+N más" en la UI); "preparado" ya no
 * cuenta aquí porque bodega ya lo empacó.
 */
export async function getOperationalDashboard(previewLimit = 10) {
  const [
    inventoryRaw, statusRaw, lowStockRaw,
    toPrepareRaw, toPrepareTotalRaw, preparedNotShippedRaw, oldestUnshippedRaw, outOfStockPendingRaw,
  ] = await Promise.all([
    prisma.$queryRaw<Array<RawRow>>`
      SELECT
        (SELECT COUNT(*)::int FROM products WHERE is_active = true) AS "totalActiveProducts",
        (SELECT COUNT(*)::int FROM products WHERE is_active = true AND stock = 0) AS "outOfStock",
        (SELECT COUNT(*)::int FROM products WHERE is_active = true AND stock > 0 AND stock_minimo > 0 AND stock <= stock_minimo) AS "lowStock",
        (SELECT COALESCE(SUM(stock), 0)::int FROM products WHERE is_active = true) AS "totalUnits",
        (SELECT COALESCE(SUM(stock_reservado), 0)::int FROM products WHERE is_active = true) AS "totalReserved"
    `,
    prisma.$queryRaw<Array<{ status: string; count: number }>>`
      SELECT status::text AS "status", COUNT(*)::int AS "count"
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY status
    `,
    // Reposición necesaria: entre los productos bajo mínimo, primero los que
    // tienen más unidades pedidas en pedidos ya pagados sin despachar — esos
    // son los que de verdad urge comprar, no solo los que tienen menos stock.
    prisma.$queryRaw<Array<RawRow>>`
      SELECT p.id, p.sku, p.nombre, p.imagenes, p.stock, p.stock_minimo AS "stockMinimo",
        COALESCE(demand.units, 0)::int AS "unitsPending"
      FROM products p
      LEFT JOIN (
        SELECT oi.product_id, SUM(oi.cantidad)::int AS units
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status = ANY(ARRAY['confirmed', 'preparado']::"OrderStatus"[]) AND o.payment_status = 'approved'
        GROUP BY oi.product_id
      ) demand ON demand.product_id = p.id
      WHERE p.is_active = true AND p.stock_minimo > 0 AND p.stock <= p.stock_minimo
      ORDER BY COALESCE(demand.units, 0) DESC, p.stock ASC
      LIMIT 20
    `,
    prisma.$queryRaw<Array<RawRow>>`
      SELECT o.id, o.order_number AS "orderNumber", o.created_at AS "createdAt",
        COALESCE(SUM(oi.cantidad), 0)::int AS "units"
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status = 'confirmed' AND o.payment_status = 'approved'
      GROUP BY o.id
      ORDER BY o.created_at ASC
      LIMIT ${previewLimit}
    `,
    prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total FROM orders WHERE status = 'confirmed' AND payment_status = 'approved'
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS "count" FROM orders WHERE status = 'preparado'
    `,
    prisma.$queryRaw<Array<{ days: number | null }>>`
      SELECT CASE WHEN MIN(created_at) IS NULL THEN NULL
        ELSE EXTRACT(DAY FROM NOW() - MIN(created_at))::int END AS "days"
      FROM orders WHERE status = ANY(ARRAY['confirmed', 'preparado']::"OrderStatus"[]) AND payment_status = 'approved'
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT p.id)::int AS "count"
      FROM products p
      JOIN order_items oi ON oi.product_id = p.id
      JOIN orders o ON o.id = oi.order_id
      WHERE p.stock <= 0
        AND o.status = ANY(ARRAY['confirmed', 'preparado']::"OrderStatus"[]) AND o.payment_status = 'approved'
    `,
  ]);

  const toPrepareTotal = Number(toPrepareTotalRaw[0]?.total ?? 0);

  return {
    inventory: inventoryRaw[0],
    ordersByStatus: statusRaw,
    lowStock: lowStockRaw,
    ordersToPrepare: {
      data: toPrepareRaw,
      total: toPrepareTotal,
      moreCount: Math.max(0, toPrepareTotal - toPrepareRaw.length),
    },
    cards: {
      toPrepare: toPrepareTotal,
      preparedNotShipped: preparedNotShippedRaw[0]?.count ?? 0,
      oldestUnshippedDays: oldestUnshippedRaw[0]?.days ?? null,
      outOfStockWithPendingOrders: outOfStockPendingRaw[0]?.count ?? 0,
    },
  };
}

/**
 * Tablero del rol comercial: solo sus propios pedidos (sellerId), sin costos,
 * márgenes ni datos de otros comerciales.
 * - porCobrar: pedidos propios aún sin pagar (pending), más antiguos primero.
 * - enProceso: pedidos propios ya pagados que todavía no llegaron al cliente
 *   (confirmado, preparado o enviado).
 */
export async function getCommercialDashboard(sellerId?: string, previewLimit = 20) {
  const scope = sellerId ? { sellerId } : {};
  const select = {
    id: true, orderNumber: true, status: true, createdAt: true, total: true,
    compradorNombre: true, compradorApellido: true,
    user: { select: { nombre: true, apellido: true } },
  } as const;

  const [porCobrar, porCobrarTotal, enProceso, enProcesoTotal] = await Promise.all([
    prisma.order.findMany({ where: { ...scope, status: 'pending' }, orderBy: { createdAt: 'asc' }, take: previewLimit, select }),
    prisma.order.count({ where: { ...scope, status: 'pending' } }),
    prisma.order.findMany({ where: { ...scope, status: { in: IN_PROGRESS_ORDER_STATUSES as unknown as OrderStatus[] } }, orderBy: { createdAt: 'asc' }, take: previewLimit, select }),
    prisma.order.count({ where: { ...scope, status: { in: IN_PROGRESS_ORDER_STATUSES as unknown as OrderStatus[] } } }),
  ]);

  const mapOrder = (o: (typeof porCobrar)[number]) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    total: toNumber(o.total),
    cliente: o.user ? `${o.user.nombre} ${o.user.apellido}`.trim() : `${o.compradorNombre} ${o.compradorApellido}`.trim(),
  });

  return {
    porCobrar: { data: porCobrar.map(mapOrder), total: porCobrarTotal, moreCount: Math.max(0, porCobrarTotal - porCobrar.length) },
    enProceso: { data: enProceso.map(mapOrder), total: enProcesoTotal, moreCount: Math.max(0, enProcesoTotal - enProceso.length) },
  };
}
