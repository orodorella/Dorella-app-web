import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { recordAudit } from './audit.service.js';
import { applyInventoryDeltas } from './inventory-stock.js';
import { CommissionError, assertDay, assertUuid, syncCommissionEntries } from './commission.service.js';

/**
 * Costos de adquisición por lotes con FIFO (ver docs/admin-finance/08-inventario-costos-lotes.md).
 *
 * Principios:
 * - Cada compra es un lote con su costo histórico (precio + gastos de adquisición prorrateados).
 * - El stock físico sigue siendo `products.stock` (sistema existente). Los lotes son capas de COSTO:
 *   una compra suma stock UNA vez (mediante applyInventoryDeltas); la valoración inicial NO suma stock.
 * - El costeo de ventas NO ocurre dentro de la transacción que consume el stock: así un fallo de
 *   costeo jamás puede bloquear un pago. Es idempotente y determinista (`syncFifoCosts`):
 *   solo usa lotes que ya existían al momento del pago y procesa las órdenes por fecha de pago.
 * - Por línea es todo-o-nada: si los lotes no cubren la cantidad completa, la línea queda 'sin_lote'
 *   (conserva el costo de catálogo si lo había, o "pendiente de costeo"); nunca se asume costo 0.
 * - Cancelación de una orden ya costeada: los lotes se restituyen (devolución); el costo congelado
 *   de la línea no se reescribe.
 */

const Decimal = Prisma.Decimal;
type DecimalValue = Prisma.Decimal;
export class LotError extends CommissionError {}

const MAX_UNITS = 1_000_000;

// Las transacciones de costeo/compra esperan bloqueos de fila y hacen varias idas a la base (pedidos mayoristas
// de 50-100 líneas, envíos duplicados): los límites por defecto de Prisma (maxWait 2 s, timeout 5 s) no alcanzan
// (hallado en pruebas con Postgres real; mismo problema que documenta inventory-stock.ts).
const COSTING_TX = { timeout: 30_000, maxWait: 10_000 } as const;

/**
 * Serializa TODO el costeo/restitución de lotes: un único bloqueo consultivo de transacción.
 * Evita que dos sincronizaciones simultáneas (pago + dashboard) costeen dos veces la misma línea
 * y elimina el riesgo de interbloqueo entre costeo y restitución (ambos toman este bloqueo primero).
 */
async function lockCosting(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('dorella:fifo-costing'))`;
}

const str = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

function parseMoney(value: unknown, label: string, required: boolean): DecimalValue {
  if (value === undefined || value === null || value === '') {
    if (required) throw new LotError('VALIDATION_ERROR', `${label} es obligatorio`);
    return new Decimal(0);
  }
  if (typeof value !== 'number' && typeof value !== 'string') throw new LotError('VALIDATION_ERROR', `${label} es inválido`);
  let amount: DecimalValue;
  try {
    amount = new Decimal(value);
  } catch {
    throw new LotError('VALIDATION_ERROR', `${label} es inválido`);
  }
  if (!amount.isFinite() || amount.lt(0) || amount.gt(9_999_999_999) || amount.decimalPlaces() > 2) {
    throw new LotError('VALIDATION_ERROR', `${label} debe estar entre 0 y 9.999.999.999 con máximo 2 decimales`);
  }
  return amount;
}

/** Costo efectivo por unidad = precio + gastos de adquisición / cantidad (4 decimales, mitad hacia arriba). */
export function effectiveUnitCost(costoUnitario: Prisma.Decimal.Value, gastos: Prisma.Decimal.Value, cantidad: number): DecimalValue {
  return new Decimal(costoUnitario).add(new Decimal(gastos).div(cantidad)).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

/** Costo total de consumir `cantidad` unidades a `costoEfectivo` (centavos, mitad hacia arriba). */
export function consumptionCost(cantidad: number, costoEfectivo: Prisma.Decimal.Value): DecimalValue {
  return new Decimal(costoEfectivo).mul(cantidad).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export interface FifoLot { id: string; restante: number; costo: DecimalValue }
export interface FifoTake { lotId: string; cantidad: number; costoUnitario: DecimalValue; costoTotal: DecimalValue }

/**
 * Plan FIFO puro: toma de los lotes en orden (ya ordenados por antigüedad). Devuelve null si no
 * alcanzan para cubrir la cantidad completa (todo-o-nada).
 */
export function planFifo(lots: FifoLot[], cantidad: number): FifoTake[] | null {
  let faltante = cantidad;
  const takes: FifoTake[] = [];
  for (const lot of lots) {
    if (faltante <= 0) break;
    if (lot.restante <= 0) continue;
    const tomar = Math.min(lot.restante, faltante);
    takes.push({ lotId: lot.id, cantidad: tomar, costoUnitario: lot.costo, costoTotal: consumptionCost(tomar, lot.costo) });
    faltante -= tomar;
  }
  return faltante > 0 ? null : takes;
}

// --------------------------------------------------------------- compras

export interface PurchaseInput {
  productId: unknown;
  tipo?: unknown; // 'compra' (por defecto) | 'valoracion_inicial'
  cantidad: unknown;
  costoUnitario: unknown;
  gastosAdicionales?: unknown;
  proveedor?: unknown;
  fechaCompra?: unknown;
  referencia?: unknown;
  observaciones?: unknown;
  idempotencyKey?: unknown;
  actorId: string;
}

export async function registerPurchase(input: PurchaseInput) {
  const productId = assertUuid(input.productId, 'Producto');
  const tipo = input.tipo === 'valoracion_inicial' ? 'valoracion_inicial' : 'compra';
  const cantidad = typeof input.cantidad === 'number' ? input.cantidad : Number(input.cantidad);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_UNITS) {
    throw new LotError('VALIDATION_ERROR', `La cantidad debe ser un entero entre 1 y ${MAX_UNITS}`);
  }
  const costoUnitario = parseMoney(input.costoUnitario, 'El costo unitario', true);
  const gastos = parseMoney(input.gastosAdicionales, 'Los gastos adicionales', false);
  const fecha = input.fechaCompra ? assertDay(input.fechaCompra, 'La fecha de compra') : new Date().toISOString().slice(0, 10);
  if (new Date(`${fecha}T00:00:00Z`).getTime() > Date.now() + 86_400_000) throw new LotError('VALIDATION_ERROR', 'La fecha de compra no puede ser futura');
  const key = str(input.idempotencyKey, 80);
  const efectivo = effectiveUnitCost(costoUnitario, gastos, cantidad);

  const run = async () => prisma.$transaction(async (tx) => {
    if (key) {
      const existing = await tx.inventoryLot.findUnique({ where: { claveIdempotencia: key } });
      if (existing) return { lot: existing, duplicate: true };
    }
    const locked = await tx.$queryRaw<Array<{ id: string; stock: number }>>`SELECT id, stock FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
    if (locked.length === 0) throw new LotError('NOT_FOUND', 'Producto no encontrado', 404);

    if (tipo === 'compra') {
      // La compra suma stock una sola vez, con las mismas reglas/CHECK que el resto del sistema.
      const ok = await applyInventoryDeltas(tx, [{ productId, stock: cantidad }]);
      if (!ok) throw new LotError('CONFLICT', 'No se pudo actualizar el inventario del producto', 409);
    } else {
      const agg = await tx.inventoryLot.aggregate({ where: { productId }, _sum: { cantidadRestante: true } });
      const sinValorar = Math.max(0, locked[0].stock - (agg._sum.cantidadRestante ?? 0));
      if (cantidad > sinValorar) {
        throw new LotError('UNITS_EXCEED_UNVALUED', `Solo hay ${sinValorar} unidades sin valorar de este producto (stock ${locked[0].stock}); no se puede valorar ${cantidad}`, 409);
      }
    }

    const lot = await tx.inventoryLot.create({
      data: {
        productId, tipo, cantidad, cantidadRestante: cantidad, costoUnitario, gastosAdicionales: gastos, costoUnitarioEfectivo: efectivo,
        proveedor: str(input.proveedor, 255), fechaCompra: new Date(`${fecha}T00:00:00Z`), referencia: str(input.referencia, 120),
        observaciones: str(input.observaciones, 2000), claveIdempotencia: key, createdBy: input.actorId,
      },
    });
    await tx.inventoryMovement.create({
      data: { productId, lotId: lot.id, tipo, cantidad, costoUnitario: efectivo, motivo: lot.referencia, createdBy: input.actorId },
    });
    await recordAudit({
      actorId: input.actorId, action: tipo === 'compra' ? 'inventory.purchase_registered' : 'inventory.initial_valuation',
      entityType: 'inventory_lot', entityId: lot.id,
      after: { productId, cantidad, costoUnitario: costoUnitario.toString(), gastosAdicionales: gastos.toString(), costoEfectivo: efectivo.toString() },
    }, tx);
    return { lot, duplicate: false };
  }, COSTING_TX);

  try {
    return await run();
  } catch (err) {
    // Dos envíos simultáneos con la misma clave: el segundo devuelve el lote del primero.
    if (key && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await prisma.inventoryLot.findUnique({ where: { claveIdempotencia: key } });
      if (existing) return { lot: existing, duplicate: true };
    }
    throw err;
  }
}

/** Ajuste de valoración de un lote (merma, corrección). No toca el stock físico: usa el ajuste de stock existente. */
export async function adjustLot(lotId: string, input: { cantidadRestante: unknown; motivo: unknown; actorId: string }) {
  const nueva = typeof input.cantidadRestante === 'number' ? input.cantidadRestante : Number(input.cantidadRestante);
  const motivo = str(input.motivo, 500);
  if (!Number.isInteger(nueva) || nueva < 0) throw new LotError('VALIDATION_ERROR', 'La cantidad restante debe ser un entero mayor o igual a 0');
  if (!motivo || motivo.length < 3) throw new LotError('VALIDATION_ERROR', 'El motivo del ajuste es obligatorio');
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; product_id: string; cantidad: number; restante: number; costo: unknown }>>`
      SELECT id, product_id, cantidad, cantidad_restante AS restante, costo_unitario_efectivo AS costo FROM inventory_lots WHERE id = ${lotId}::uuid FOR UPDATE`;
    const lot = rows[0];
    if (!lot) throw new LotError('NOT_FOUND', 'Lote no encontrado', 404);
    if (nueva > lot.cantidad) throw new LotError('VALIDATION_ERROR', `No puede superar la cantidad comprada (${lot.cantidad})`);
    // Lo consumido por órdenes activas puede volver al lote si se cancelan: el ajuste debe dejarles espacio.
    const activos = await tx.lotConsumption.aggregate({ where: { lotId, reversedAt: null }, _sum: { cantidad: true } });
    const consumido = activos._sum.cantidad ?? 0;
    if (nueva + consumido > lot.cantidad) {
      throw new LotError('VALIDATION_ERROR', `Hay ${consumido} unidades consumidas por órdenes activas; el máximo ajustable es ${lot.cantidad - consumido}`, 409);
    }
    const delta = nueva - lot.restante;
    if (delta === 0) return { id: lot.id, cantidadRestante: nueva, sinCambios: true };
    await tx.inventoryLot.update({ where: { id: lotId }, data: { cantidadRestante: nueva } });
    await tx.inventoryMovement.create({
      data: { productId: lot.product_id, lotId, tipo: 'ajuste', cantidad: delta, costoUnitario: new Decimal(String(lot.costo)), motivo, createdBy: input.actorId },
    });
    await recordAudit({
      actorId: input.actorId, action: 'inventory.lot_adjusted', entityType: 'inventory_lot', entityId: lotId,
      before: { cantidadRestante: lot.restante }, after: { cantidadRestante: nueva, motivo },
    }, tx);
    return { id: lot.id, cantidadRestante: nueva, sinCambios: false };
  }, COSTING_TX);
}

// ------------------------------------------------------------- costeo FIFO

interface PaidOrder {
  id: string; paidAt: Date | null; updatedAt: Date;
  items: Array<{ id: string; productId: string; cantidad: number; sku: string }>;
}

async function allocateOrder(order: PaidOrder): Promise<{ costed: number; unCovered: number }> {
  const at = order.paidAt ?? order.updatedAt;
  // Orden estable por producto (mismo criterio de bloqueo que el resto del sistema).
  const items = [...order.items].filter((i) => !i.sku.startsWith('ACD-')).sort((a, b) => a.productId.localeCompare(b.productId) || a.id.localeCompare(b.id));
  let costed = 0;
  let unCovered = 0;

  await prisma.$transaction(async (tx) => {
    await lockCosting(tx);
    for (const item of items) {
      // Se comprueba DENTRO del bloqueo global: otra sincronización pudo costear esta línea mientras esperábamos.
      const done = await tx.lotConsumption.count({ where: { orderItemId: item.id, reversedAt: null } });
      const marked = await tx.orderItem.findUnique({ where: { id: item.id }, select: { costoMetodo: true } });
      if (done > 0 || (marked && marked.costoMetodo !== null)) continue; // idempotente: ya evaluada
      const lots = await tx.$queryRaw<Array<{ id: string; restante: number; costo: unknown }>>`
        SELECT id, cantidad_restante AS restante, costo_unitario_efectivo AS costo
        FROM inventory_lots
        WHERE product_id = ${item.productId}::uuid AND cantidad_restante > 0 AND created_at <= ${at}
        ORDER BY fecha_compra ASC, created_at ASC, id ASC
        FOR UPDATE`;
      const plan = planFifo(lots.map((l) => ({ id: l.id, restante: l.restante, costo: new Decimal(String(l.costo)) })), item.cantidad);
      if (!plan) {
        await tx.orderItem.update({ where: { id: item.id }, data: { costoMetodo: 'sin_lote' } });
        unCovered += 1;
        continue;
      }
      let total = new Decimal(0);
      for (const take of plan) {
        const claimed = await tx.inventoryLot.updateMany({
          where: { id: take.lotId, cantidadRestante: { gte: take.cantidad } },
          data: { cantidadRestante: { decrement: take.cantidad } },
        });
        if (claimed.count !== 1) throw new LotError('CONFLICT', 'Un lote cambió durante el costeo; se reintentará', 409);
        await tx.lotConsumption.create({
          data: { lotId: take.lotId, orderItemId: item.id, cantidad: take.cantidad, costoUnitario: take.costoUnitario, costoTotal: take.costoTotal },
        });
        await tx.inventoryMovement.create({
          data: { productId: item.productId, lotId: take.lotId, orderItemId: item.id, tipo: 'venta', cantidad: -take.cantidad, costoUnitario: take.costoUnitario },
        });
        total = total.add(take.costoTotal);
      }
      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          costoTotalSnapshot: total,
          costoUnitarioSnapshot: total.div(item.cantidad).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
          costoMetodo: 'fifo',
        },
      });
      costed += 1;
    }
  }, COSTING_TX);
  return { costed, unCovered };
}

async function restoreOrder(orderId: string, now: Date): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await lockCosting(tx);
    const active = await tx.lotConsumption.findMany({
      where: { reversedAt: null, orderItem: { orderId } },
      select: { id: true, lotId: true, cantidad: true, costoUnitario: true, orderItemId: true, orderItem: { select: { productId: true } } },
      orderBy: { lotId: 'asc' },
    });
    let restored = 0;
    for (const c of active) {
      const marked = await tx.lotConsumption.updateMany({ where: { id: c.id, reversedAt: null }, data: { reversedAt: now } });
      if (marked.count !== 1) continue; // otra ejecución ya la restituyó
      // Nunca supera lo comprado (protege el CHECK aunque un ajuste manual haya subido el restante).
      await tx.$executeRaw`UPDATE inventory_lots SET cantidad_restante = LEAST(cantidad, cantidad_restante + ${c.cantidad}) WHERE id = ${c.lotId}::uuid`;
      await tx.inventoryMovement.create({
        data: { productId: c.orderItem.productId, lotId: c.lotId, orderItemId: c.orderItemId, tipo: 'devolucion', cantidad: c.cantidad, costoUnitario: c.costoUnitario, motivo: 'Orden cancelada' },
      });
      restored += 1;
    }
    return restored;
  }, COSTING_TX);
}

/**
 * Costea (FIFO) las órdenes pagadas pendientes y restituye lotes de las canceladas. Idempotente.
 * Se llama antes de calcular rentabilidad/valoración y, en modo "mejor esfuerzo", al pagar o cancelar.
 */
export async function syncFifoCosts(options: { now?: Date; maxOrders?: number } = {}) {
  const now = options.now ?? new Date();
  let costed = 0;
  let restored = 0;
  let unCovered = 0;
  let failed = 0;

  // 1) Restituir lotes de órdenes canceladas o con pago devuelto que aún tienen consumo activo.
  const cancelled = await prisma.order.findMany({
    where: {
      // Solo órdenes canceladas: ahí el sistema existente también restituye el stock. Un reembolso sin
      // cancelación no devuelve stock, así que tampoco se devuelven lotes (evita inflar el inventario valorizado).
      status: 'cancelled',
      items: { some: { lotConsumptions: { some: { reversedAt: null } } } },
    },
    select: { id: true },
    take: 200,
  });
  for (const o of cancelled) {
    try {
      restored += await restoreOrder(o.id, now);
    } catch (err) {
      failed += 1;
      console.error('[FIFO] No se pudo restituir lotes de la orden', o.id, err);
    }
  }

  // 1b) Líneas que NO pueden tener lote (ningún lote con existencias creado antes del pago): se marcan 'sin_lote'
  // en una sola sentencia. Es el caso de todo el histórico anterior a esta función; evita una transacción por orden.
  await prisma.$transaction(async (tx) => {
    await lockCosting(tx);
    await tx.$executeRaw`
      UPDATE order_items oi SET costo_metodo = 'sin_lote'
      FROM orders o
      WHERE o.id = oi.order_id AND oi.costo_metodo IS NULL AND oi.sku NOT LIKE 'ACD-%'
        AND o.payment_status::text = 'approved' AND o.status::text <> 'cancelled'
        AND NOT EXISTS (
          SELECT 1 FROM inventory_lots l
          WHERE l.product_id = oi.product_id AND l.cantidad_restante > 0 AND l.created_at <= COALESCE(o.paid_at, o.updated_at)
        )`;
  }, COSTING_TX);

  // 2) Costear órdenes pagadas, en orden de pago (determinista), que tengan líneas sin evaluar.
  const pending = await prisma.order.findMany({
    where: {
      paymentStatus: 'approved', status: { not: 'cancelled' },
      items: { some: { costoMetodo: null, sku: { not: { startsWith: 'ACD-' } } } },
    },
    select: { id: true, paidAt: true, updatedAt: true, items: { select: { id: true, productId: true, cantidad: true, sku: true } } },
    orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
    take: options.maxOrders ?? 200,
  });
  for (const order of pending) {
    // Una orden problemática no debe impedir costear las demás ni tumbar los reportes.
    try {
      const r = await allocateOrder(order);
      costed += r.costed;
      unCovered += r.unCovered;
    } catch (err) {
      failed += 1;
      console.error('[FIFO] No se pudo costear la orden', order.id, err);
    }
  }
  return { costed, restored, unCovered, failed };
}

// ---------------------------------------------------- trabajador automático

export interface CostingStatus {
  lastRunAt: string | null;
  lastResult: { costed: number; restored: number; unCovered: number; failed: number } | null;
  lastError: string | null;
  consecutiveFailures: number;
}

const workerState = { running: false, skip: 0, consecutiveFailures: 0, lastRunAt: null as Date | null, lastResult: null as CostingStatus['lastResult'], lastError: null as string | null };

/**
 * Una ronda del trabajador. Nunca lanza: registra el resultado y aplica retroceso exponencial
 * (hasta ~30 rondas) si hay fallos seguidos, de modo que un problema persistente no sature la base.
 * Es seguro con varias instancias: el costeo se serializa con un bloqueo consultivo en la base.
 */
export async function runCostingTick(): Promise<void> {
  if (workerState.running) return;
  if (workerState.skip > 0) { workerState.skip -= 1; return; }
  workerState.running = true;
  try {
    const result = await syncFifoCosts();
    // La causación de comisiones también va aquí (antes se hacía al abrir el resumen y lo volvía lento).
    await syncCommissionEntries().catch((err) => {
      result.failed += 1;
      console.error('[comisiones] No se pudo causar comisiones (se reintentará)', err);
    });
    workerState.lastResult = result;
    // Los fallos por orden no lanzan: se resumen aquí (el detalle queda en los registros del servidor).
    workerState.lastError = result.failed > 0 ? `${result.failed} orden(es) no se pudieron costear; se reintentará` : null;
    workerState.lastRunAt = new Date();
    if (result.failed > 0) {
      workerState.consecutiveFailures += 1;
      workerState.skip = Math.min(2 ** workerState.consecutiveFailures, 30);
    } else {
      workerState.consecutiveFailures = 0;
    }
  } catch (err) {
    workerState.consecutiveFailures += 1;
    workerState.skip = Math.min(2 ** workerState.consecutiveFailures, 30);
    workerState.lastError = err instanceof Error ? err.message : String(err);
    workerState.lastRunAt = new Date();
    console.error('[FIFO] Ronda de costeo fallida (se reintentará)', err);
  } finally {
    workerState.running = false;
  }
}

/**
 * Costeo automático: no depende de que alguien abra un reporte. Reintenta solo, es idempotente y se
 * apoya en el estado de la base (líneas pagadas sin evaluar), así que se recupera tras reinicios.
 */
export function startFifoCostingWorker(intervalMs = 60_000): void {
  const timer = setInterval(() => void runCostingTick(), intervalMs);
  timer.unref();
  const first = setTimeout(() => void runCostingTick(), 20_000);
  first.unref();
}

/** Operaciones de costeo pendientes (visibles para el administrador) y estado del trabajador. */
export async function getCostingStatus(): Promise<CostingStatus & { pendientes: { ordenesPorCostear: number; ordenesPorRestituir: number; lineasSinLote: number } }> {
  const [porCostear, porRestituir, sinLote] = await Promise.all([
    prisma.order.count({ where: { paymentStatus: 'approved', status: { not: 'cancelled' }, items: { some: { costoMetodo: null, sku: { not: { startsWith: 'ACD-' } } } } } }),
    prisma.order.count({ where: { status: 'cancelled', items: { some: { lotConsumptions: { some: { reversedAt: null } } } } } }),
    prisma.orderItem.count({ where: { costoMetodo: 'sin_lote' } }),
  ]);
  return {
    lastRunAt: workerState.lastRunAt?.toISOString() ?? null,
    lastResult: workerState.lastResult,
    lastError: workerState.lastError,
    consecutiveFailures: workerState.consecutiveFailures,
    pendientes: { ordenesPorCostear: porCostear, ordenesPorRestituir: porRestituir, lineasSinLote: sinLote },
  };
}

/** Test helper: reinicia el estado del trabajador. */
export function __resetCostingWorkerForTests(): void {
  Object.assign(workerState, { running: false, skip: 0, consecutiveFailures: 0, lastRunAt: null, lastResult: null, lastError: null });
}

/** Para los flujos de pago/cancelación: nunca debe romper la operación principal. */
export function syncFifoCostsInBackground(): void {
  void syncFifoCosts().catch((err) => console.error('[FIFO] No se pudo costear en segundo plano (se reintentará)', err));
}

// ------------------------------------------------------------ valoración

export async function getInventoryValuation(from: string, to: string) {
  assertDay(from, 'La fecha inicial');
  assertDay(to, 'La fecha final');
  // Solo lectura (el trabajador costea en segundo plano).

  const [products, purchases] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; sku: string; nombre: string; stock: number; valoradas: number; valor: unknown; lotes: number }>>`
      SELECT p.id::text AS id, p.sku, p.nombre, p.stock,
        COALESCE(SUM(l.cantidad_restante), 0)::int AS valoradas,
        COALESCE(SUM(l.cantidad_restante * l.costo_unitario_efectivo), 0) AS valor,
        COUNT(l.id) FILTER (WHERE l.cantidad_restante > 0)::int AS lotes
      FROM products p
      LEFT JOIN inventory_lots l ON l.product_id = p.id
      WHERE p.is_active = true OR EXISTS (SELECT 1 FROM inventory_lots x WHERE x.product_id = p.id AND x.cantidad_restante > 0)
      GROUP BY p.id, p.sku, p.nombre, p.stock
    `,
    prisma.$queryRaw<Array<{ total: unknown; unidades: unknown; lotes: number }>>`
      SELECT COALESCE(SUM(cantidad * costo_unitario + gastos_adicionales), 0) AS total,
        COALESCE(SUM(cantidad), 0) AS unidades, COUNT(*)::int AS lotes
      FROM inventory_lots
      WHERE tipo::text = 'compra' AND fecha_compra >= ${from}::date AND fecha_compra <= ${to}::date
    `,
  ]);

  let valorizado = new Decimal(0);
  let unidadesValoradas = 0;
  let unidadesSinValorar = 0;
  let productosConExceso = 0;
  const rows = products.map((p) => {
    const valor = new Decimal(String(p.valor));
    valorizado = valorizado.add(valor);
    unidadesValoradas += p.valoradas;
    const sinValorar = Math.max(0, p.stock - p.valoradas);
    unidadesSinValorar += sinValorar;
    const exceso = p.valoradas > p.stock;
    if (exceso) productosConExceso += 1;
    return {
      id: p.id, sku: p.sku, nombre: p.nombre, stock: p.stock, unidadesValoradas: p.valoradas, unidadesSinValorar: sinValorar,
      valorizado: Number(valor), costoPromedio: p.valoradas ? Number(valor.div(p.valoradas).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)) : null,
      lotesActivos: p.lotes, valoracionExcedeStock: exceso,
    };
  }).sort((a, b) => b.valorizado - a.valorizado);

  return {
    from, to,
    resumen: {
      comprasPeriodo: Number(new Decimal(String(purchases[0]?.total ?? 0))),
      unidadesCompradasPeriodo: Number(purchases[0]?.unidades ?? 0),
      lotesPeriodo: purchases[0]?.lotes ?? 0,
      inventarioValorizado: Number(valorizado),
      unidadesValoradas,
      unidadesSinValorar,
      costoPromedioUnitario: unidadesValoradas ? Number(valorizado.div(unidadesValoradas).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)) : null,
      productosConValoracionMayorAlStock: productosConExceso,
    },
    notas: [
      'Inventario valorizado = Σ unidades restantes de cada lote × su costo efectivo (precio + gastos de adquisición prorrateados).',
      'Las unidades sin lote NO se valoran (no se asume costo): usa «Valoración inicial» para asignarles costo.',
      'Compras del periodo no restan del resultado: el costo llega al estado de resultados al venderse (costo de mercancía vendida).',
      'Costo promedio unitario es informativo; el costeo de ventas es FIFO.',
    ],
    productos: rows.slice(0, 200),
  };
}

export async function getProductCostHistory(productId: string) {
  const id = assertUuid(productId, 'Producto');
  const [lots, movements, catalog] = await Promise.all([
    prisma.inventoryLot.findMany({ where: { productId: id }, orderBy: [{ fechaCompra: 'desc' }, { createdAt: 'desc' }], take: 100 }),
    prisma.inventoryMovement.findMany({ where: { productId: id }, orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.productCost.findMany({ where: { productId: id }, orderBy: { validFrom: 'desc' }, take: 50 }),
  ]);
  return {
    lotes: lots.map((l) => ({
      id: l.id, tipo: l.tipo, fechaCompra: l.fechaCompra.toISOString().slice(0, 10), proveedor: l.proveedor, referencia: l.referencia,
      cantidad: l.cantidad, cantidadRestante: l.cantidadRestante, costoUnitario: Number(l.costoUnitario), gastosAdicionales: Number(l.gastosAdicionales),
      costoEfectivo: Number(l.costoUnitarioEfectivo), observaciones: l.observaciones,
    })),
    movimientos: movements.map((m) => ({
      id: m.id, tipo: m.tipo, cantidad: m.cantidad, costoUnitario: m.costoUnitario ? Number(m.costoUnitario) : null, motivo: m.motivo, fecha: m.createdAt.toISOString(),
    })),
    costosCatalogo: catalog.map((c) => ({ costoTotal: Number(c.costoTotal), validFrom: c.validFrom.toISOString() })),
  };
}
