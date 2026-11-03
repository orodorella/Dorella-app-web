import { Prisma, type Tier } from '@prisma/client';
import { prisma } from '../config/db.js';
import { recordAudit } from './audit.service.js';

/**
 * Comisiones de comerciales (ver docs/admin-finance/03-fase3-comisiones.md).
 *
 * Política inicial (decisión de negocio aprobada):
 * - Estimada: orden de un comercial sin pago aprobado y no cancelada (no se guarda;
 *   se calcula con el porcentaje vigente hoy, solo informativa).
 * - Causada: orden con pago aprobado. Se guarda una instantánea (base, porcentaje,
 *   monto) con el porcentaje vigente en la FECHA DE PAGO, de modo que un cambio
 *   posterior de porcentaje nunca altera lo ya causado.
 * - Pagada: la entrada pertenece a una liquidación marcada como pagada.
 * - Anulada: si la orden se cancela/reembolsa antes de liquidar, la entrada se anula;
 *   si ya estaba en una liquidación, se crea un ajuste negativo (único por entrada)
 *   que se descuenta en la siguiente liquidación. Lo cerrado nunca se reescribe.
 * - Base = suma de order_items.subtotal (mercancía después de descuentos, sin flete).
 * - Solo vendedores con rol `comercial` generan comisión; tienda/sin vendedor, no.
 * La causación es perezosa e idempotente (`syncCommissionEntries`): no depende de
 * ganchos en los flujos de pago, y la regla se resuelve por fecha de pago, no de sync.
 */

const Decimal = Prisma.Decimal;
type DecimalValue = Prisma.Decimal;

export class CommissionError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

const REFUND_PAYMENT_STATUSES = ['refunded', 'charged_back', 'cancelled', 'rejected'] as const;
const TIERS: readonly Tier[] = ['detal', 'por_mayor', 'gran_mayor'];

// Colombia no tiene horario de verano: -05:00 fijo.
export const startOfDay = (day: string) => new Date(`${day}T00:00:00-05:00`);
export const startOfNextDay = (day: string) => new Date(startOfDay(day).getTime() + 86_400_000);

/** Fecha de hoy en hora de Colombia (YYYY-MM-DD). */
export const todayInBogota = (now = new Date()) => new Date(now.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertUuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new CommissionError('VALIDATION_ERROR', `${label} inválido`);
  return value;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export function assertDay(value: unknown, label: string): string {
  if (typeof value !== 'string' || !DAY_RE.test(value) || Number.isNaN(Date.parse(value))
    || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new CommissionError('VALIDATION_ERROR', `${label} debe ser una fecha válida con formato AAAA-MM-DD`);
  }
  return value;
}

/** Comisión = base × porcentaje / 100, redondeada a centavos (mitad hacia arriba). */
export function calculateCommission(base: Prisma.Decimal.Value, porcentaje: Prisma.Decimal.Value): DecimalValue {
  return new Decimal(base).mul(porcentaje).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Porcentaje válido: 0–100 con hasta 4 decimales. */
export function parsePercentage(value: unknown): DecimalValue {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new CommissionError('VALIDATION_ERROR', 'El porcentaje es obligatorio');
  }
  let pct: DecimalValue;
  try {
    pct = new Decimal(value);
  } catch {
    throw new CommissionError('VALIDATION_ERROR', 'El porcentaje no es un número válido');
  }
  if (!pct.isFinite() || pct.lt(0) || pct.gt(100)) {
    throw new CommissionError('VALIDATION_ERROR', 'El porcentaje debe estar entre 0 y 100');
  }
  if (pct.decimalPlaces() > 4) {
    throw new CommissionError('VALIDATION_ERROR', 'El porcentaje admite máximo 4 decimales');
  }
  return pct;
}

export interface RuleLike {
  id: string;
  tier: Tier;
  userId: string | null;
  porcentaje: DecimalValue;
  validFrom: Date;
  validTo: Date | null;
}

/** Regla vigente en `at`: la específica del comercial prevalece sobre la general. */
export function resolveRuleAt(rules: RuleLike[], sellerId: string, tier: Tier, at: Date): RuleLike | null {
  const active = rules.filter(
    (r) => r.tier === tier && r.validFrom <= at && (r.validTo === null || at < r.validTo),
  );
  const newest = (list: RuleLike[]) => list.sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0] ?? null;
  return newest(active.filter((r) => r.userId === sellerId)) ?? newest(active.filter((r) => r.userId === null));
}

// ---------------------------------------------------------------- reglas

export async function listRules() {
  const rules = await prisma.commissionRule.findMany({
    orderBy: [{ tier: 'asc' }, { validFrom: 'desc' }],
    include: { user: { select: { nombre: true, apellido: true } } },
  });
  const mapped = rules.map((r) => ({
    id: r.id,
    tier: r.tier,
    userId: r.userId,
    sellerName: r.user ? `${r.user.nombre} ${r.user.apellido}`.trim() : null,
    porcentaje: Number(r.porcentaje),
    validFrom: r.validFrom.toISOString(),
    validTo: r.validTo?.toISOString() ?? null,
  }));
  return { current: mapped.filter((r) => r.validTo === null), history: mapped.filter((r) => r.validTo !== null) };
}

export async function setCommissionRule(input: {
  tier: unknown; userId?: string | null; porcentaje: unknown; actorId: string; now?: Date;
}) {
  if (!TIERS.includes(input.tier as Tier)) throw new CommissionError('VALIDATION_ERROR', 'Modalidad inválida');
  const tier = input.tier as Tier;
  const porcentaje = parsePercentage(input.porcentaje);
  const userId = input.userId ?? null;
  const now = input.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    if (userId) {
      const seller = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (!seller || seller.role !== 'comercial') {
        throw new CommissionError('VALIDATION_ERROR', 'El usuario no es un comercial', 404);
      }
    }
    const open = await tx.commissionRule.findFirst({ where: { tier, userId, validTo: null } });
    if (open && open.porcentaje.equals(porcentaje)) return open; // sin cambios
    if (open) await tx.commissionRule.update({ where: { id: open.id }, data: { validTo: now } });
    const created = await tx.commissionRule.create({
      data: { tier, userId, porcentaje, validFrom: now, createdBy: input.actorId },
    });
    await recordAudit({
      actorId: input.actorId,
      action: 'commission.rule_changed',
      entityType: 'commission_rule',
      entityId: created.id,
      before: open ? { porcentaje: open.porcentaje.toString() } : undefined,
      after: { tier, userId, porcentaje: porcentaje.toString() },
    }, tx);
    return created;
  });
}

// ------------------------------------------------------------- causación

/** Causa comisiones de órdenes pagadas y revierte las de órdenes canceladas/reembolsadas. Idempotente. */
export async function syncCommissionEntries(now = new Date()): Promise<{ accrued: number; voided: number; clawbacks: number }> {
  const rules = (await prisma.commissionRule.findMany()) as RuleLike[];
  let accrued = 0;
  let voided = 0;
  let clawbacks = 0;

  // 1) Causar: pago aprobado, no cancelada, vendedor comercial, sin entrada.
  for (;;) {
    const orders = await prisma.order.findMany({
      where: {
        sellerId: { not: null },
        // Rol al crear la orden; en órdenes anteriores (sin dato) se usa el rol actual.
        OR: [{ sellerRole: 'comercial' }, { sellerRole: null, seller: { role: 'comercial' } }],
        paymentStatus: 'approved',
        status: { not: 'cancelled' },
        commissionEntry: null,
      },
      select: { id: true, sellerId: true, tierAtPurchase: true, paidAt: true, updatedAt: true, items: { select: { subtotal: true } } },
      take: 200,
    });
    if (orders.length === 0) break;
    let progressed = 0;
    for (const order of orders) {
      const at = order.paidAt ?? order.updatedAt;
      const base = order.items.reduce((sum, item) => sum.add(item.subtotal), new Decimal(0));
      const rule = resolveRuleAt(rules, order.sellerId!, order.tierAtPurchase, at);
      const porcentaje = rule?.porcentaje ?? new Decimal(0);
      try {
        await prisma.commissionEntry.create({
          data: {
            orderId: order.id, sellerId: order.sellerId!, tier: order.tierAtPurchase,
            base, porcentaje, monto: calculateCommission(base, porcentaje), ruleId: rule?.id ?? null, accruedAt: at,
          },
        });
        accrued += 1;
        progressed += 1;
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err; // ya causada por otra sync
        progressed += 1;
      }
    }
    if (progressed === 0 || orders.length < 200) break;
  }

  // 2) Revertir: orden cancelada o con pago devuelto/rechazado.
  const toReverse = await prisma.commissionEntry.findMany({
    where: {
      voidedAt: null,
      order: {
        OR: [
          { status: 'cancelled' },
          { paymentStatus: { in: [...REFUND_PAYMENT_STATUSES] } },
          // Mercado Pago no actualiza orders.payment_status tras la aprobación: el reembolso o
          // contracargo queda solo en el intento de pago.
          { paymentAttempts: { some: { status: { in: ['refunded', 'charged_back'] } } } },
        ],
      },
    },
    select: { id: true, sellerId: true, monto: true, liquidationId: true, order: { select: { orderNumber: true } } },
  });
  for (const entry of toReverse) {
    if (!entry.liquidationId) {
      const res = await prisma.commissionEntry.updateMany({
        where: { id: entry.id, voidedAt: null, liquidationId: null },
        data: { status: 'voided', voidedAt: now },
      });
      voided += res.count;
    } else {
      await prisma.$transaction(async (tx) => {
        const marked = await tx.commissionEntry.updateMany({ where: { id: entry.id, voidedAt: null }, data: { voidedAt: now } });
        if (marked.count === 0) return;
        await tx.commissionAdjustment.create({
          data: {
            sellerId: entry.sellerId, monto: entry.monto.negated(), entryId: entry.id,
            motivo: `Reversión por cancelación/reembolso de la orden ${entry.order.orderNumber}`,
          },
        });
        clawbacks += 1;
      });
    }
  }
  return { accrued, voided, clawbacks };
}

// --------------------------------------------------------------- resumen

export async function getCommissionSummary(from: string, to: string) {
  assertDay(from, 'La fecha inicial');
  assertDay(to, 'La fecha final');
  // Solo lectura: las comisiones se causan en el trabajador en segundo plano (≤ 1 min) y al liquidar.
  const start = startOfDay(from);
  const end = startOfNextDay(to);

  const [entries, estimatedRaw, pendingAdjustments, sellers, rules] = await Promise.all([
    prisma.$queryRaw<Array<{ sellerId: string; tier: Tier; porcentaje: unknown; orders: number; base: unknown; monto: unknown; status: string }>>`
      SELECT seller_id::text AS "sellerId", tier::text AS "tier", porcentaje, COUNT(*)::int AS "orders",
        SUM(base) AS "base", SUM(monto) AS "monto", status::text AS "status"
      FROM commission_entries
      WHERE status::text <> 'voided' AND accrued_at >= ${start} AND accrued_at < ${end}
      GROUP BY seller_id, tier, porcentaje, status
    `,
    prisma.$queryRaw<Array<{ sellerId: string; tier: Tier; orders: number; base: unknown }>>`
      SELECT o.seller_id::text AS "sellerId", o.tier_at_purchase::text AS "tier",
        COUNT(DISTINCT o.id)::int AS "orders", SUM(oi.subtotal) AS "base"
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN users u ON u.id = o.seller_id
      WHERE COALESCE(o.seller_role, u.role::text) = 'comercial'
        AND o.created_at >= ${start} AND o.created_at < ${end}
        AND o.status::text <> 'cancelled'
        AND (o.payment_status IS NULL OR o.payment_status::text IN ('pending', 'in_process'))
      GROUP BY o.seller_id, o.tier_at_purchase
    `,
    prisma.commissionAdjustment.groupBy({ by: ['sellerId'], where: { liquidationId: null }, _sum: { monto: true } }),
    prisma.user.findMany({ where: { OR: [{ role: 'comercial' }, { commissionEntries: { some: {} } }] }, select: { id: true, nombre: true, apellido: true, isActive: true } }),
    prisma.commissionRule.findMany({ where: { validTo: null } }),
  ]);

  const now = new Date();
  const result = new Map<string, {
    sellerId: string; nombre: string; isActive: boolean;
    lines: Array<{ tier: Tier; porcentaje: number; orders: number; base: number; monto: number; status: string }>;
    estimada: DecimalValue; causada: DecimalValue; pagada: DecimalValue; ajustesPendientes: DecimalValue;
  }>();
  const ensure = (id: string) => {
    let row = result.get(id);
    if (!row) {
      const u = sellers.find((s) => s.id === id);
      row = {
        sellerId: id, nombre: u ? `${u.nombre} ${u.apellido}`.trim() : 'Usuario', isActive: u?.isActive ?? true,
        lines: [], estimada: new Decimal(0), causada: new Decimal(0), pagada: new Decimal(0), ajustesPendientes: new Decimal(0),
      };
      result.set(id, row);
    }
    return row;
  };
  for (const s of sellers) ensure(s.id);

  for (const e of entries) {
    const row = ensure(e.sellerId);
    row.lines.push({ tier: e.tier, porcentaje: Number(e.porcentaje), orders: e.orders, base: Number(e.base), monto: Number(e.monto), status: e.status });
    if (e.status === 'paid') row.pagada = row.pagada.add(new Decimal(String(e.monto)));
    else row.causada = row.causada.add(new Decimal(String(e.monto)));
  }
  for (const e of estimatedRaw) {
    const rule = resolveRuleAt(rules as RuleLike[], e.sellerId, e.tier, now);
    const row = ensure(e.sellerId);
    row.estimada = row.estimada.add(calculateCommission(new Decimal(String(e.base)), rule?.porcentaje ?? 0));
  }
  for (const a of pendingAdjustments) ensure(a.sellerId).ajustesPendientes = a._sum.monto ?? new Decimal(0);

  return {
    from, to,
    sellers: [...result.values()].map((r) => ({
      ...r,
      estimada: Number(r.estimada), causada: Number(r.causada), pagada: Number(r.pagada), ajustesPendientes: Number(r.ajustesPendientes),
    })),
  };
}

// ---------------------------------------------------------- liquidaciones

export async function createLiquidation(input: { sellerId: string; from: string; to: string; actorId: string; notas?: string }) {
  assertDay(input.from, 'La fecha inicial');
  assertDay(input.to, 'La fecha final');
  if (input.from > input.to) throw new CommissionError('VALIDATION_ERROR', 'La fecha inicial no puede ser posterior a la final');
  await syncCommissionEntries();

  return prisma.$transaction(async (tx) => {
    const seller = await tx.user.findUnique({ where: { id: input.sellerId }, select: { id: true, role: true } });
    // Lo ya causado se puede liquidar aunque la persona haya dejado de ser comercial.
    const hasHistory = seller ? (await tx.commissionEntry.count({ where: { sellerId: seller.id } })) > 0 : false;
    if (!seller || (seller.role !== 'comercial' && !hasHistory)) throw new CommissionError('NOT_FOUND', 'Comercial no encontrado', 404);

    const entries = await tx.commissionEntry.findMany({
      where: {
        sellerId: seller.id, status: 'accrued', liquidationId: null, voidedAt: null,
        accruedAt: { gte: startOfDay(input.from), lt: startOfNextDay(input.to) },
      },
      select: { id: true, monto: true },
    });
    const adjustments = await tx.commissionAdjustment.findMany({
      where: { sellerId: seller.id, liquidationId: null }, select: { id: true, monto: true },
    });
    if (entries.length === 0 && adjustments.length === 0) {
      throw new CommissionError('NOTHING_TO_LIQUIDATE', 'No hay comisiones causadas ni ajustes para liquidar en ese periodo', 409);
    }

    const subtotal = entries.reduce((sum, e) => sum.add(e.monto), new Decimal(0));
    const ajustes = adjustments.reduce((sum, a) => sum.add(a.monto), new Decimal(0));
    const liquidation = await tx.commissionLiquidation.create({
      data: {
        sellerId: seller.id, periodFrom: new Date(`${input.from}T00:00:00Z`), periodTo: new Date(`${input.to}T00:00:00Z`),
        subtotal, ajustes, total: subtotal.add(ajustes), notas: input.notas ?? null, createdBy: input.actorId,
      },
    });

    // Reclamo atómico: si otra liquidación tomó alguna fila entre la lectura y aquí, se aborta.
    const claimedEntries = await tx.commissionEntry.updateMany({
      where: { id: { in: entries.map((e) => e.id) }, liquidationId: null, status: 'accrued', voidedAt: null },
      data: { liquidationId: liquidation.id },
    });
    const claimedAdjustments = await tx.commissionAdjustment.updateMany({
      where: { id: { in: adjustments.map((a) => a.id) }, liquidationId: null }, data: { liquidationId: liquidation.id },
    });
    if (claimedEntries.count !== entries.length || claimedAdjustments.count !== adjustments.length) {
      throw new CommissionError('CONFLICT', 'Otra liquidación modificó estas comisiones; intenta de nuevo', 409);
    }
    await recordAudit({
      actorId: input.actorId, action: 'commission.liquidation_created', entityType: 'commission_liquidation',
      entityId: liquidation.id, after: { sellerId: seller.id, from: input.from, to: input.to, total: liquidation.total.toString() },
    }, tx);
    return liquidation;
  });
}

export async function markLiquidationPaid(id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.commissionLiquidation.findUnique({ where: { id } });
    if (!current) throw new CommissionError('NOT_FOUND', 'Liquidación no encontrada', 404);
    if (current.status === 'paid') return current; // idempotente
    const claimed = await tx.commissionLiquidation.updateMany({
      where: { id, status: 'pending' }, data: { status: 'paid', paidAt: new Date(), paidBy: actorId },
    });
    if (claimed.count === 1) {
      await tx.commissionEntry.updateMany({ where: { liquidationId: id, status: 'accrued' }, data: { status: 'paid' } });
      await recordAudit({
        actorId, action: 'commission.liquidation_paid', entityType: 'commission_liquidation', entityId: id,
        after: { total: current.total.toString() },
      }, tx);
    }
    return tx.commissionLiquidation.findUniqueOrThrow({ where: { id } });
  });
}

export async function addAdjustment(input: { sellerId: string; monto: unknown; motivo: unknown; actorId: string }) {
  let monto: DecimalValue;
  try {
    monto = new Decimal(typeof input.monto === 'number' || typeof input.monto === 'string' ? input.monto : NaN);
  } catch {
    throw new CommissionError('VALIDATION_ERROR', 'El monto del ajuste es inválido');
  }
  if (!monto.isFinite() || monto.isZero() || monto.abs().gt(1_000_000_000_000) || monto.decimalPlaces() > 2) {
    throw new CommissionError('VALIDATION_ERROR', 'El monto del ajuste es inválido');
  }
  const motivo = typeof input.motivo === 'string' ? input.motivo.trim() : '';
  if (motivo.length < 3 || motivo.length > 500) throw new CommissionError('VALIDATION_ERROR', 'El motivo es obligatorio (3 a 500 caracteres)');
  const seller = await prisma.user.findUnique({ where: { id: input.sellerId }, select: { role: true } });
  const hasHistory = seller ? (await prisma.commissionEntry.count({ where: { sellerId: input.sellerId } })) > 0 : false;
  if (!seller || (seller.role !== 'comercial' && !hasHistory)) throw new CommissionError('NOT_FOUND', 'Comercial no encontrado', 404);
  const adjustment = await prisma.commissionAdjustment.create({
    data: { sellerId: input.sellerId, monto, motivo, createdBy: input.actorId },
  });
  await recordAudit({
    actorId: input.actorId, action: 'commission.adjustment_created', entityType: 'commission_adjustment',
    entityId: adjustment.id, after: { sellerId: input.sellerId, monto: monto.toString(), motivo },
  });
  return adjustment;
}

export async function listLiquidations(query: { sellerId?: string; status?: string }) {
  const where: Prisma.CommissionLiquidationWhereInput = {};
  if (query.sellerId) where.sellerId = query.sellerId;
  if (query.status === 'pending' || query.status === 'paid') where.status = query.status;
  const rows = await prisma.commissionLiquidation.findMany({
    where, orderBy: { createdAt: 'desc' }, take: 100,
    include: { seller: { select: { nombre: true, apellido: true } }, _count: { select: { entries: true } } },
  });
  return rows.map((l) => ({
    id: l.id, sellerId: l.sellerId, sellerName: `${l.seller.nombre} ${l.seller.apellido}`.trim(),
    periodFrom: l.periodFrom.toISOString().slice(0, 10), periodTo: l.periodTo.toISOString().slice(0, 10),
    subtotal: Number(l.subtotal), ajustes: Number(l.ajustes), total: Number(l.total), status: l.status,
    entries: l._count.entries, createdAt: l.createdAt.toISOString(), paidAt: l.paidAt?.toISOString() ?? null,
  }));
}

export async function getLiquidationDetail(id: string) {
  const l = await prisma.commissionLiquidation.findUnique({
    where: { id },
    include: {
      seller: { select: { nombre: true, apellido: true } },
      entries: { include: { order: { select: { orderNumber: true } } }, orderBy: { accruedAt: 'asc' } },
      adjustments: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!l) throw new CommissionError('NOT_FOUND', 'Liquidación no encontrada', 404);
  return {
    id: l.id, sellerName: `${l.seller.nombre} ${l.seller.apellido}`.trim(),
    periodFrom: l.periodFrom.toISOString().slice(0, 10), periodTo: l.periodTo.toISOString().slice(0, 10),
    subtotal: Number(l.subtotal), ajustes: Number(l.ajustes), total: Number(l.total), status: l.status,
    createdAt: l.createdAt.toISOString(), paidAt: l.paidAt?.toISOString() ?? null,
    entries: l.entries.map((e) => ({
      orderNumber: e.order.orderNumber, tier: e.tier, base: Number(e.base), porcentaje: Number(e.porcentaje),
      monto: Number(e.monto), status: e.status, accruedAt: e.accruedAt.toISOString(),
    })),
    adjustments: l.adjustments.map((a) => ({ monto: Number(a.monto), motivo: a.motivo, createdAt: a.createdAt.toISOString() })),
  };
}

const csvCell = (value: unknown, numeric = false): string => {
  let text = String(value ?? '');
  // Neutraliza fórmulas solo en texto; los montos (incluso negativos) quedan numéricos.
  if (!numeric && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",;\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

type Cell = string | { n: number };
const num = (n: number): Cell => ({ n });

/** CSV (UTF-8 con BOM, separador coma) del detalle de una liquidación. */
export function liquidationToCsv(detail: Awaited<ReturnType<typeof getLiquidationDetail>>): string {
  const lines: Cell[][] = [
    ['Comercial', detail.sellerName], ['Periodo', `${detail.periodFrom} a ${detail.periodTo}`],
    ['Estado', detail.status === 'paid' ? 'Pagada' : 'Pendiente'], [],
    ['Orden', 'Modalidad', 'Base', 'Porcentaje', 'Comisión', 'Estado'],
    ...detail.entries.map((e): Cell[] => [e.orderNumber, e.tier, num(e.base), num(e.porcentaje), num(e.monto), e.status]),
    [], ['Ajustes', 'Motivo'],
    ...detail.adjustments.map((a): Cell[] => [num(a.monto), a.motivo]),
    [], ['Subtotal', num(detail.subtotal)], ['Ajustes', num(detail.ajustes)], ['Total a pagar', num(detail.total)],
  ];
  const cell = (c: Cell) => (typeof c === 'string' ? csvCell(c) : csvCell(c.n, true));
  return `\uFEFF${lines.map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`;
}
