import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { recordAudit } from './audit.service.js';
import { CommissionError, assertDay, startOfDay, startOfNextDay } from './commission.service.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';
import { sumOperatingExpenses } from './expense.service.js';

/**
 * Costos de productos y rentabilidad (ver docs/admin-finance/04-fase4-costos-rentabilidad.md).
 *
 * - Historial: cada cambio de costo es una fila nueva en product_costs; nunca se edita.
 * - Cada línea de orden congela el costo vigente al crearse (order_items.costo_unitario_snapshot).
 *   NULL = "pendiente de costeo": se informa aparte y jamás se trata como costo 0.
 * - Cambiar el costo o el precio de un producto no altera la rentabilidad de órdenes ya creadas.
 * - Ingreso = suma de order_items.subtotal de órdenes con pago aprobado y no canceladas.
 * - Utilidad bruta = ingreso costeado − costo de mercancía vendida. NO es utilidad neta.
 */

const Decimal = Prisma.Decimal;
type DecimalValue = Prisma.Decimal;

export class FinanceError extends CommissionError {}

const money = (value: unknown): DecimalValue => new Decimal(value === null || value === undefined ? 0 : String(value));

/** Utilidad, margen sobre ventas y recargo sobre costo. Porcentajes con 2 decimales; null si el divisor es 0. */
export function profitMetrics(ingreso: Prisma.Decimal.Value, costo: Prisma.Decimal.Value) {
  const revenue = new Decimal(ingreso);
  const cost = new Decimal(costo);
  const utilidad = revenue.sub(cost);
  const pct = (num: DecimalValue, den: DecimalValue) =>
    den.isZero() ? null : Number(num.div(den).mul(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
  return {
    ingreso: Number(revenue),
    costo: Number(cost),
    utilidad: Number(utilidad),
    margenPct: pct(utilidad, revenue), // utilidad / precio de venta
    recargoPct: pct(utilidad, cost), // utilidad / costo (markup)
  };
}

function parseMoney(value: unknown, label: string, required: boolean): DecimalValue {
  if (value === undefined || value === null || value === '') {
    if (required) throw new FinanceError('VALIDATION_ERROR', `${label} es obligatorio`);
    return new Decimal(0);
  }
  if (typeof value !== 'number' && typeof value !== 'string') throw new FinanceError('VALIDATION_ERROR', `${label} es inválido`);
  let amount: DecimalValue;
  try {
    amount = new Decimal(value);
  } catch {
    throw new FinanceError('VALIDATION_ERROR', `${label} es inválido`);
  }
  if (!amount.isFinite() || amount.lt(0) || amount.gt(9_999_999_999) || amount.decimalPlaces() > 2) {
    throw new FinanceError('VALIDATION_ERROR', `${label} debe ser un monto entre 0 y 9.999.999.999 con máximo 2 decimales`);
  }
  return amount;
}

export async function listProductCosts(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const where: Prisma.ProductWhereInput = { isActive: true };
  if (search) {
    where.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { referenciaProveedor: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (query.sinCosto === 'true') where.costs = { none: {} };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true, sku: true, nombre: true, precioBase: true, proveedor: true,
        category: { select: { nombre: true } },
        costs: { where: { validFrom: { lte: new Date() } }, orderBy: { validFrom: 'desc' }, take: 1 },
      },
      orderBy: { nombre: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  const data = products.map((p) => {
    const cost = p.costs[0] ?? null;
    return {
      id: p.id, sku: p.sku, nombre: p.nombre, categoria: p.category.nombre, proveedor: p.proveedor,
      precioVenta: Number(p.precioBase),
      costoAdquisicion: cost ? Number(cost.costoAdquisicion) : null,
      costoAdicional: cost ? Number(cost.costoAdicional) : null,
      costoTotal: cost ? Number(cost.costoTotal) : null,
      costoActualizado: cost?.validFrom.toISOString() ?? null,
      // Métricas sobre el precio de lista (detal); el margen real por orden sale de las ventas.
      ...(cost ? (({ margenPct, recargoPct, utilidad }) => ({ margenPct, recargoPct, utilidadUnitaria: utilidad }))(profitMetrics(p.precioBase, cost.costoTotal)) : { margenPct: null, recargoPct: null, utilidadUnitaria: null }),
    };
  });
  return { data, meta: buildMeta(page, pageSize, total) };
}

export async function setProductCost(input: {
  productId: string; costoAdquisicion: unknown; costoAdicional?: unknown; validFrom?: unknown; notas?: unknown; actorId: string;
}) {
  const costoAdquisicion = parseMoney(input.costoAdquisicion, 'El costo de adquisición', true);
  const costoAdicional = parseMoney(input.costoAdicional, 'El costo adicional', false);
  let validFrom = new Date();
  if (input.validFrom !== undefined && input.validFrom !== null && input.validFrom !== '') {
    validFrom = startOfDay(assertDay(input.validFrom, 'La fecha de vigencia'));
    if (validFrom.getTime() > Date.now()) throw new FinanceError('VALIDATION_ERROR', 'La fecha de vigencia no puede ser futura');
  }
  const notas = typeof input.notas === 'string' && input.notas.trim() ? input.notas.trim().slice(0, 500) : null;
  const costoTotal = costoAdquisicion.add(costoAdicional);

  const product = await prisma.product.findUnique({ where: { id: input.productId }, select: { id: true } });
  if (!product) throw new FinanceError('NOT_FOUND', 'Producto no encontrado', 404);

  const created = await prisma.productCost.create({
    data: { productId: product.id, costoAdquisicion, costoAdicional, costoTotal, validFrom, notas, createdBy: input.actorId },
  });
  await recordAudit({
    actorId: input.actorId, action: 'product.cost_changed', entityType: 'product', entityId: product.id,
    after: { costoAdquisicion: costoAdquisicion.toString(), costoAdicional: costoAdicional.toString(), costoTotal: costoTotal.toString(), validFrom: validFrom.toISOString() },
  });
  return created;
}

export async function getCostHistory(productId: string) {
  const rows = await prisma.productCost.findMany({ where: { productId }, orderBy: { validFrom: 'desc' }, take: 100 });
  return rows.map((r) => ({
    id: r.id, costoAdquisicion: Number(r.costoAdquisicion), costoAdicional: Number(r.costoAdicional), costoTotal: Number(r.costoTotal),
    validFrom: r.validFrom.toISOString(), notas: r.notas, createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Costea líneas históricas SIN costo usando el costo que estaba vigente en la fecha de la orden
 * (requiere que el admin haya cargado costos con fecha de vigencia pasada). Solo toca líneas
 * con snapshot NULL; las ya costeadas no cambian. Las que no tengan costo vigente siguen pendientes.
 */
export async function backfillOrderCosts(actorId: string): Promise<{ updated: number }> {
  const updated = await prisma.$executeRaw`
    UPDATE order_items oi
    SET costo_unitario_snapshot = (
      SELECT c.costo_total FROM product_costs c JOIN orders o ON o.id = oi.order_id
      WHERE c.product_id = oi.product_id AND c.valid_from <= o.created_at
      ORDER BY c.valid_from DESC LIMIT 1
    )
    WHERE oi.costo_unitario_snapshot IS NULL
      AND oi.sku NOT LIKE 'ACD-%'
      AND EXISTS (
        SELECT 1 FROM product_costs c JOIN orders o ON o.id = oi.order_id
        WHERE c.product_id = oi.product_id AND c.valid_from <= o.created_at
      )
  `;
  await recordAudit({ actorId, action: 'order_items.cost_backfill', entityType: 'order_item', after: { updated } });
  return { updated };
}

// ----------------------------------------------------------- rentabilidad

export interface ProfitFilters { from: string; to: string; categoryId?: string; tier?: string; sellerId?: string }

interface ProfitRow {
  productId: string; sku: string; nombre: string; categoryId: string; category: string; tier: string;
  units: number; revenueCosted: unknown; cogs: unknown; revenuePending: unknown; unitsPending: number;
}

type Bucket = { revenueCosted: DecimalValue; cogs: DecimalValue; revenuePending: DecimalValue; unitsPending: number; units: number };
const emptyBucket = (): Bucket => ({ revenueCosted: new Decimal(0), cogs: new Decimal(0), revenuePending: new Decimal(0), unitsPending: 0, units: 0 });
const addRow = (b: Bucket, r: ProfitRow) => {
  b.revenueCosted = b.revenueCosted.add(money(r.revenueCosted));
  b.cogs = b.cogs.add(money(r.cogs));
  b.revenuePending = b.revenuePending.add(money(r.revenuePending));
  b.unitsPending += r.unitsPending;
  b.units += r.units;
};
const present = (b: Bucket) => ({
  ...profitMetrics(b.revenueCosted, b.cogs),
  ingresoPendienteCosteo: Number(b.revenuePending),
  unidades: b.units,
  unidadesPendientes: b.unitsPending,
});

export async function getProfitability(filters: ProfitFilters) {
  assertDay(filters.from, 'La fecha inicial');
  assertDay(filters.to, 'La fecha final');
  if (filters.from > filters.to) throw new FinanceError('VALIDATION_ERROR', 'La fecha inicial no puede ser posterior a la final');
  const start = startOfDay(filters.from);
  const end = startOfNextDay(filters.to);

  // Solo lectura: el costeo FIFO lo hace el trabajador en segundo plano (ver lot.service). Antes cada visita al
  // reporte costeaba hasta 200 órdenes y tardaba ~20 s con el histórico.

  const conds: Prisma.Sql[] = [
    Prisma.sql`o.created_at >= ${start} AND o.created_at < ${end}`,
    Prisma.sql`o.payment_status::text = 'approved'`,
    Prisma.sql`o.status::text <> 'cancelled'`,
  ];
  if (filters.categoryId) conds.push(Prisma.sql`p.category_id = ${filters.categoryId}::uuid`);
  if (filters.tier) conds.push(Prisma.sql`o.tier_at_purchase::text = ${filters.tier}`);
  if (filters.sellerId === 'sin-asignar') conds.push(Prisma.sql`o.seller_id IS NULL`);
  else if (filters.sellerId) conds.push(Prisma.sql`o.seller_id = ${filters.sellerId}::uuid`);

  const [rows, commissionRows, gastos] = await Promise.all([
    prisma.$queryRaw<ProfitRow[]>`
      SELECT p.id::text AS "productId", p.sku, p.nombre, c.id::text AS "categoryId", c.nombre AS "category",
        o.tier_at_purchase::text AS "tier",
        COALESCE(SUM(oi.cantidad), 0)::int AS "units",
        COALESCE(SUM(oi.subtotal) FILTER (WHERE oi.costo_unitario_snapshot IS NOT NULL), 0) AS "revenueCosted",
        COALESCE(SUM(COALESCE(oi.costo_total_snapshot, oi.cantidad * oi.costo_unitario_snapshot)) FILTER (WHERE oi.costo_unitario_snapshot IS NOT NULL), 0) AS "cogs",
        COALESCE(SUM(oi.subtotal) FILTER (WHERE oi.costo_unitario_snapshot IS NULL), 0) AS "revenuePending",
        COALESCE(SUM(oi.cantidad) FILTER (WHERE oi.costo_unitario_snapshot IS NULL), 0)::int AS "unitsPending"
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      JOIN categories c ON c.id = p.category_id
      WHERE ${Prisma.join(conds, ' AND ')}
      GROUP BY p.id, p.sku, p.nombre, c.id, c.nombre, o.tier_at_purchase
    `,
    prisma.$queryRaw<Array<{ monto: unknown }>>`
      SELECT COALESCE(SUM(monto), 0) AS "monto" FROM commission_entries
      WHERE status::text <> 'voided' AND voided_at IS NULL AND accrued_at >= ${start} AND accrued_at < ${end}
    `,
    // Solo categorías que afectan el resultado: lo capitalizado al costo no se resta dos veces.
    sumOperatingExpenses(filters.from, filters.to),
  ]);

  const total = emptyBucket();
  const byProduct = new Map<string, Bucket & { sku: string; nombre: string }>();
  const byCategory = new Map<string, Bucket & { nombre: string }>();
  const byTier = new Map<string, Bucket>();
  for (const row of rows) {
    addRow(total, row);
    addRow(byProduct.get(row.productId) ?? byProduct.set(row.productId, { ...emptyBucket(), sku: row.sku, nombre: row.nombre }).get(row.productId)!, row);
    addRow(byCategory.get(row.categoryId) ?? byCategory.set(row.categoryId, { ...emptyBucket(), nombre: row.category }).get(row.categoryId)!, row);
    addRow(byTier.get(row.tier) ?? byTier.set(row.tier, emptyBucket()).get(row.tier)!, row);
  }

  const comisiones = money(commissionRows[0]?.monto);
  const gross = profitMetrics(total.revenueCosted, total.cogs);
  return {
    filters,
    notas: [
      'Utilidad bruta = ingreso costeado − costo de mercancía vendida. No es utilidad neta.',
      'Las líneas sin costo registrado se muestran como pendientes de costeo y NO entran al cálculo.',
      'Resultado operativo estimado = utilidad bruta − comisiones − gastos operativos del periodo (excluye lo pendiente de costeo, impuestos y gastos no registrados).',
      'Ingreso = subtotal de líneas de órdenes con pago aprobado y no canceladas; el esquema no desglosa IVA.',
    ],
    resumen: {
      ...present(total),
      comisionesCausadas: Number(comisiones),
      utilidadDespuesDeComisiones: Number(new Decimal(gross.utilidad).sub(comisiones)),
      gastosOperativos: Number(gastos),
      resultadoOperativoEstimado: Number(new Decimal(gross.utilidad).sub(comisiones).sub(gastos)),
    },
    porProducto: [...byProduct.entries()]
      .map(([id, b]) => ({ id, sku: b.sku, nombre: b.nombre, ...present(b) }))
      .sort((a, b) => b.utilidad - a.utilidad)
      .slice(0, 100),
    porCategoria: [...byCategory.entries()].map(([id, b]) => ({ id, nombre: b.nombre, ...present(b) })).sort((a, b) => b.utilidad - a.utilidad),
    porModalidad: ['detal', 'por_mayor', 'gran_mayor'].map((tier) => ({ tier, ...present(byTier.get(tier) ?? emptyBucket()) })),
  };
}
