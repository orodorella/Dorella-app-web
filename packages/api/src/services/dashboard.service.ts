import { prisma } from '../config/db.js';

export async function getDashboardData() {
  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Batch 1: inventory (5) + topProducts (1) = 6 concurrent
  const [inventory, topProducts] = await Promise.all([
    Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: true, stock: 0 } }),
      prisma.product.count({ where: { isActive: true, stock: { gt: 0, lt: 10 } } }),
      prisma.product.aggregate({ where: { isActive: true }, _sum: { stock: true } }),
      prisma.product.aggregate({ where: { isActive: true }, _sum: { stockReservado: true } }),
    ]),
    prisma.$queryRaw`
      SELECT
        oi.product_id as "productId",
        p.sku,
        p.nombre,
        p.stock,
        p.imagenes,
        SUM(oi.cantidad)::int as "totalSold",
        ROUND(SUM(oi.cantidad)::numeric / 30, 2) as "averageDaily",
        CASE
          WHEN SUM(oi.cantidad) = 0 THEN NULL
          ELSE ROUND(p.stock::numeric / (SUM(oi.cantidad) / 30), 0)::int
        END as "daysOfInventory",
        ROUND(SUM(oi.cantidad * oi.precio_unitario)::numeric, 0)::int as "totalRevenue",
        ROUND(SUM(oi.cantidad * oi.precio_unitario)::numeric / 30, 0)::int as "averageDailyRevenue"
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      WHERE o.created_at > NOW() - INTERVAL '30 days'
        AND o.status != 'cancelled'
      GROUP BY oi.product_id, p.sku, p.nombre, p.stock, p.imagenes
      ORDER BY "totalSold" DESC
      LIMIT 10
    `,
  ]);

  // Batch 2: restockAlerts (1) + revenue (4) + ordersByStatus (1) = 6 concurrent
  const [restockAlerts, revenue, ordersByStatus] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        sub."productId",
        sub.sku,
        sub.nombre,
        sub.stock,
        sub.imagenes,
        sub."totalSold",
        sub."averageDaily",
        sub."daysOfInventory",
        sub."totalRevenue",
        sub."averageDailyRevenue"
      FROM (
        SELECT
          oi.product_id as "productId",
          p.sku,
          p.nombre,
          p.stock,
          p.imagenes,
          SUM(oi.cantidad)::int as "totalSold",
          ROUND(SUM(oi.cantidad)::numeric / 30, 2) as "averageDaily",
          CASE
            WHEN SUM(oi.cantidad) = 0 THEN NULL
            ELSE ROUND(p.stock::numeric / (SUM(oi.cantidad) / 30), 0)::int
          END as "daysOfInventory",
          ROUND(SUM(oi.cantidad * oi.precio_unitario)::numeric, 0)::int as "totalRevenue",
          ROUND(SUM(oi.cantidad * oi.precio_unitario)::numeric / 30, 0)::int as "averageDailyRevenue"
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN products p ON oi.product_id = p.id
        WHERE o.created_at > NOW() - INTERVAL '30 days'
          AND o.status != 'cancelled'
        GROUP BY oi.product_id, p.sku, p.nombre, p.stock, p.imagenes
      ) sub
      WHERE sub."daysOfInventory" IS NOT NULL AND sub."daysOfInventory" < 7
      ORDER BY sub."daysOfInventory" ASC
    `,
    Promise.all([
      prisma.order.aggregate({ where: { status: { not: 'cancelled' } }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { status: { not: 'cancelled' }, createdAt: { gte: last7Days } }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { status: { not: 'cancelled' }, createdAt: { gte: last30Days } }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { status: { not: 'cancelled' } }, _avg: { total: true } }),
    ]),
    prisma.order.groupBy({ by: ['status'], _count: true }),
  ]);

  // Batch 3: remaining 4 queries
  const [revenueTimeline, recentOrders, totalOrders, pendingOrders] = await Promise.all([
    prisma.$queryRaw`
      SELECT DATE(created_at) as date, SUM(total)::int as revenue
      FROM orders
      WHERE status != 'cancelled' AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `,
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { nombre: true, apellido: true } },
      },
    }),
    prisma.order.count(),
    prisma.order.count({ where: { status: 'pending' } }),
  ]);

  const [totalActiveProducts, outOfStock, lowStock, totalUnits, totalReserved] = inventory;
  const [revenueTotal, revenue7d, revenue30d, avgOrderValue] = revenue;

  const ordersByStatusMap: Record<string, number> = {};
  for (const row of ordersByStatus) {
    ordersByStatusMap[row.status] = row._count;
  }

  return {
    summary: {
      totalRevenue: Number(revenueTotal._sum.total ?? 0),
      revenueLast7Days: Number(revenue7d._sum.total ?? 0),
      revenueLast30Days: Number(revenue30d._sum.total ?? 0),
      averageOrderValue: Number(avgOrderValue._avg.total ?? 0),
      totalOrders,
      pendingOrders,
    },
    inventory: {
      totalActiveProducts,
      outOfStock,
      lowStock,
      totalUnits: Number(totalUnits._sum.stock ?? 0),
      totalReserved: Number(totalReserved._sum.stockReservado ?? 0),
    },
    topProducts: (topProducts as Array<Record<string, unknown>>).map((p) => ({
      productId: p.productId,
      sku: p.sku,
      nombre: p.nombre,
      stock: p.stock,
      imagenes: p.imagenes,
      totalSold: p.totalSold,
      averageDaily: Number(p.averageDaily),
      daysOfInventory: p.daysOfInventory,
      totalRevenue: p.totalRevenue,
      averageDailyRevenue: Number(p.averageDailyRevenue),
    })),
    restockAlerts: (restockAlerts as Array<Record<string, unknown>>).map((p) => ({
      productId: p.productId,
      sku: p.sku,
      nombre: p.nombre,
      stock: p.stock,
      imagenes: p.imagenes,
      totalSold: p.totalSold,
      averageDaily: Number(p.averageDaily),
      daysOfInventory: p.daysOfInventory,
      totalRevenue: p.totalRevenue,
      averageDailyRevenue: Number(p.averageDailyRevenue),
    })),
    ordersByStatus: ordersByStatusMap,
    revenueTimeline: (revenueTimeline as Array<Record<string, unknown>>).map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      revenue: r.revenue,
    })),
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: Number(o.total),
      tierAtPurchase: o.tierAtPurchase,
      customerName: `${o.user.nombre} ${o.user.apellido}`.trim(),
      createdAt: o.createdAt.toISOString(),
    })),
  };
}
