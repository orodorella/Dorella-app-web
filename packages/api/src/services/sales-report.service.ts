import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';

/**
 * Reportes de ventas por comercial.
 *
 * Definiciones (ver docs/admin-finance/02-fase2-ventas-por-comercial.md):
 * - "Venta" = suma de order_items.subtotal (mercancía después de descuentos, sin
 *   fletes ni otros conceptos) de órdenes NO canceladas.
 * - "Pagado" = misma suma, pero solo de órdenes con payment_status = 'approved'.
 * - Modalidad = orders.tier_at_purchase. Vendedor = orders.seller_id; las órdenes
 *   sin vendedor se agrupan como "Sin comercial asignado".
 * - Las fechas se interpretan en hora de Colombia (America/Bogota).
 * Las sumas se hacen en SQL (numeric) y solo se convierten a number al salir.
 */

export const TIMEZONE = 'America/Bogota';
export const UNASSIGNED_SELLER = 'sin-asignar';

const TIERS = ['detal', 'por_mayor', 'gran_mayor'] as const;
const STATUSES = ['pending', 'confirmed', 'invoiced', 'shipped', 'delivered', 'cancelled'] as const;
const GRANULARITIES = ['day', 'week', 'month'] as const;

export type Granularity = (typeof GRANULARITIES)[number];

export interface SalesFilters {
  from: string; // YYYY-MM-DD (inclusive, hora Colombia)
  to: string; // YYYY-MM-DD (inclusive, hora Colombia)
  sellerId?: string; // uuid o UNASSIGNED_SELLER
  categoryId?: string;
  tier?: (typeof TIERS)[number];
  status?: (typeof STATUSES)[number];
  granularity: Granularity;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SalesFilterError extends Error {}

function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Valida y normaliza los filtros de la query string. Por defecto: últimos 30 días. */
export function parseSalesFilters(query: Record<string, unknown>, now = new Date()): SalesFilters {
  const str = (key: string) => (typeof query[key] === 'string' && query[key] !== '' ? (query[key] as string) : undefined);

  const to = str('to') ?? toDay(now);
  const from = str('from') ?? toDay(new Date(new Date(`${to}T00:00:00Z`).getTime() - 29 * 86_400_000));
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    throw new SalesFilterError('Las fechas deben tener formato AAAA-MM-DD');
  }
  if (from > to) throw new SalesFilterError('La fecha inicial no puede ser posterior a la final');
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > 730) {
    throw new SalesFilterError('El rango máximo es de 2 años');
  }

  const sellerId = str('sellerId');
  if (sellerId && sellerId !== UNASSIGNED_SELLER && !UUID_RE.test(sellerId)) throw new SalesFilterError('Comercial inválido');
  const categoryId = str('categoryId');
  if (categoryId && !UUID_RE.test(categoryId)) throw new SalesFilterError('Categoría inválida');
  const tier = str('tier');
  if (tier && !(TIERS as readonly string[]).includes(tier)) throw new SalesFilterError('Modalidad inválida');
  const status = str('status');
  if (status && !(STATUSES as readonly string[]).includes(status)) throw new SalesFilterError('Estado inválido');
  const granularity = str('granularity') ?? 'day';
  if (!(GRANULARITIES as readonly string[]).includes(granularity)) throw new SalesFilterError('Granularidad inválida');

  return {
    from,
    to,
    sellerId,
    categoryId,
    tier: tier as SalesFilters['tier'],
    status: status as SalesFilters['status'],
    granularity: granularity as Granularity,
  };
}

/** Periodo inmediatamente anterior, con la misma duración, para comparar. */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  const days = Math.round((end - start) / 86_400_000) + 1;
  return {
    from: toDay(new Date(start - days * 86_400_000)),
    to: toDay(new Date(start - 86_400_000)),
  };
}

/** Porcentaje (0-100, 1 decimal) o null si el total es 0. */
export function sharePct(part: number, total: number): number | null {
  if (!total) return null;
  return Math.round((part / total) * 1000) / 10;
}

/** Variación porcentual contra el periodo anterior; null si no hay base de comparación. */
export function deltaPct(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function whereClause(filters: Pick<SalesFilters, 'from' | 'to' | 'sellerId' | 'categoryId' | 'tier' | 'status'>): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`(o.created_at AT TIME ZONE ${TIMEZONE})::date BETWEEN ${filters.from}::date AND ${filters.to}::date`,
  ];
  // Sin filtro explícito de estado, las canceladas no cuentan como venta.
  parts.push(filters.status ? Prisma.sql`o.status::text = ${filters.status}` : Prisma.sql`o.status::text <> 'cancelled'`);
  if (filters.sellerId === UNASSIGNED_SELLER) parts.push(Prisma.sql`o.seller_id IS NULL`);
  else if (filters.sellerId) parts.push(Prisma.sql`o.seller_id = ${filters.sellerId}::uuid`);
  if (filters.tier) parts.push(Prisma.sql`o.tier_at_purchase::text = ${filters.tier}`);
  if (filters.categoryId) parts.push(Prisma.sql`p.category_id = ${filters.categoryId}::uuid`);
  return Prisma.join(parts, ' AND ');
}

const num = (value: unknown): number => (value === null || value === undefined ? 0 : Number(value));

interface SellerTierRow {
  sellerId: string | null;
  sellerName: string | null;
  tier: string;
  orders: number;
  units: number;
  revenue: unknown;
  paidRevenue: unknown;
}

async function sellerTierRows(filters: SalesFilters): Promise<SellerTierRow[]> {
  return prisma.$queryRaw<SellerTierRow[]>`
    SELECT o.seller_id::text AS "sellerId",
      NULLIF(TRIM(CONCAT(u.nombre, ' ', u.apellido)), '') AS "sellerName",
      o.tier_at_purchase::text AS "tier",
      COUNT(DISTINCT o.id)::int AS "orders",
      COALESCE(SUM(oi.cantidad), 0)::int AS "units",
      COALESCE(SUM(oi.subtotal), 0) AS "revenue",
      COALESCE(SUM(oi.subtotal) FILTER (WHERE o.payment_status::text = 'approved'), 0) AS "paidRevenue"
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    LEFT JOIN users u ON u.id = o.seller_id
    WHERE ${whereClause(filters)}
    GROUP BY o.seller_id, u.nombre, u.apellido, o.tier_at_purchase
  `;
}

export async function getCommercialPerformance(filters: SalesFilters) {
  const previous = previousPeriod(filters.from, filters.to);
  const bucket = Prisma.raw(`'${filters.granularity}'`); // valor validado contra lista cerrada

  const [rows, previousRows, timelineRaw, categoryRaw, sellerOrderCounts] = await Promise.all([
    sellerTierRows(filters),
    sellerTierRows({ ...filters, ...previous }),
    prisma.$queryRaw<Array<{ bucket: string; sellerId: string | null; revenue: unknown; orders: number }>>`
      SELECT date_trunc(${bucket}, o.created_at AT TIME ZONE ${TIMEZONE})::date::text AS "bucket",
        o.seller_id::text AS "sellerId",
        COALESCE(SUM(oi.subtotal), 0) AS "revenue",
        COUNT(DISTINCT o.id)::int AS "orders"
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      WHERE ${whereClause(filters)}
      GROUP BY 1, o.seller_id
      ORDER BY 1 ASC
    `,
    prisma.$queryRaw<Array<{ categoryId: string; category: string; sellerId: string | null; units: number; revenue: unknown }>>`
      SELECT c.id::text AS "categoryId", c.nombre AS "category", o.seller_id::text AS "sellerId",
        COALESCE(SUM(oi.cantidad), 0)::int AS "units",
        COALESCE(SUM(oi.subtotal), 0) AS "revenue"
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      JOIN categories c ON c.id = p.category_id
      WHERE ${whereClause(filters)}
      GROUP BY c.id, c.nombre, o.seller_id
      ORDER BY "revenue" DESC
    `,
    // Las órdenes tienen varias líneas: el conteo de órdenes por vendedor se hace aparte
    // para no depender de la combinación vendedor × modalidad.
    prisma.$queryRaw<Array<{ sellerId: string | null; orders: number }>>`
      SELECT o.seller_id::text AS "sellerId", COUNT(DISTINCT o.id)::int AS "orders"
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      WHERE ${whereClause(filters)}
      GROUP BY o.seller_id
    `,
  ]);

  const key = (sellerId: string | null) => sellerId ?? UNASSIGNED_SELLER;
  const sellers = new Map<string, {
    sellerId: string; nombre: string; orders: number; units: number; revenue: number; paidRevenue: number;
    byTier: Record<string, { revenue: number; units: number }>;
  }>();

  for (const row of rows) {
    const id = key(row.sellerId);
    const entry = sellers.get(id) ?? {
      sellerId: id,
      nombre: row.sellerId ? row.sellerName ?? 'Usuario sin nombre' : 'Sin comercial asignado',
      orders: 0, units: 0, revenue: 0, paidRevenue: 0,
      byTier: Object.fromEntries(TIERS.map((t) => [t, { revenue: 0, units: 0 }])),
    };
    entry.units += row.units;
    entry.revenue += num(row.revenue);
    entry.paidRevenue += num(row.paidRevenue);
    entry.byTier[row.tier] = { revenue: num(row.revenue), units: row.units };
    sellers.set(id, entry);
  }
  for (const row of sellerOrderCounts) {
    const entry = sellers.get(key(row.sellerId));
    if (entry) entry.orders = row.orders;
  }

  const previousRevenue = new Map<string, number>();
  for (const row of previousRows) {
    previousRevenue.set(key(row.sellerId), (previousRevenue.get(key(row.sellerId)) ?? 0) + num(row.revenue));
  }

  const totalRevenue = [...sellers.values()].reduce((sum, s) => sum + s.revenue, 0);
  const totalOrders = [...sellers.values()].reduce((sum, s) => sum + s.orders, 0);
  const totalUnits = [...sellers.values()].reduce((sum, s) => sum + s.units, 0);
  const totalPrevious = [...previousRevenue.values()].reduce((sum, v) => sum + v, 0);

  const sellerList = [...sellers.values()]
    .map((s) => ({
      ...s,
      ticketPromedio: s.orders ? Math.round(s.revenue / s.orders) : 0,
      participacionPct: sharePct(s.revenue, totalRevenue),
      periodoAnterior: previousRevenue.get(s.sellerId) ?? 0,
      variacionPct: deltaPct(s.revenue, previousRevenue.get(s.sellerId) ?? 0),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const nameById = new Map(sellerList.map((s) => [s.sellerId, s.nombre]));
  const categories = new Map<string, { categoryId: string; category: string; units: number; revenue: number }>();
  for (const row of categoryRaw) {
    const entry = categories.get(row.categoryId) ?? { categoryId: row.categoryId, category: row.category, units: 0, revenue: 0 };
    entry.units += row.units;
    entry.revenue += num(row.revenue);
    categories.set(row.categoryId, entry);
  }

  return {
    filters,
    previousPeriod: previous,
    totals: {
      revenue: totalRevenue,
      orders: totalOrders,
      units: totalUnits,
      ticketPromedio: totalOrders ? Math.round(totalRevenue / totalOrders) : 0,
      periodoAnterior: totalPrevious,
      variacionPct: deltaPct(totalRevenue, totalPrevious),
    },
    sellers: sellerList,
    byTier: TIERS.map((tier) => ({
      tier,
      revenue: sellerList.reduce((sum, s) => sum + s.byTier[tier].revenue, 0),
      units: sellerList.reduce((sum, s) => sum + s.byTier[tier].units, 0),
    })),
    byCategory: [...categories.values()].sort((a, b) => b.revenue - a.revenue),
    timeline: timelineRaw.map((row) => ({
      bucket: row.bucket,
      sellerId: key(row.sellerId),
      sellerName: nameById.get(key(row.sellerId)) ?? 'Sin comercial asignado',
      revenue: num(row.revenue),
      orders: row.orders,
    })),
  };
}

/** Comerciales disponibles para el filtro (usuarios con rol comercial o que ya tienen ventas). */
export async function listSellers() {
  const users = await prisma.user.findMany({
    where: { OR: [{ role: 'comercial' }, { salesOrders: { some: {} } }] },
    select: { id: true, nombre: true, apellido: true, role: true, isActive: true },
    orderBy: [{ nombre: 'asc' }],
  });
  return users.map((u) => ({
    id: u.id,
    nombre: `${u.nombre} ${u.apellido}`.trim(),
    role: u.role,
    isActive: u.isActive,
  }));
}
