import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { recordAudit } from './audit.service.js';
import { CommissionError, assertDay, assertUuid } from './commission.service.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';

/**
 * Gastos operativos (ver docs/admin-finance/05-fase5-gastos.md).
 * - Importes en COP con Prisma.Decimal; `valor` > 0.
 * - Un gasto no se borra: se anula con motivo (queda auditado y fuera de los totales).
 * - Categorías con `afectaResultado=false` (p. ej. flete de compra ya incluido en el costo del
 *   producto) se registran pero NO restan del resultado operativo, para evitar doble conteo.
 */

const Decimal = Prisma.Decimal;
export class ExpenseError extends CommissionError {}

const str = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

function parseValor(value: unknown): Prisma.Decimal {
  if (typeof value !== 'number' && typeof value !== 'string') throw new ExpenseError('VALIDATION_ERROR', 'El valor es obligatorio');
  let amount: Prisma.Decimal;
  try {
    amount = new Decimal(value);
  } catch {
    throw new ExpenseError('VALIDATION_ERROR', 'El valor no es un número válido');
  }
  if (!amount.isFinite() || amount.lte(0) || amount.gt(999_999_999_999) || amount.decimalPlaces() > 2) {
    throw new ExpenseError('VALIDATION_ERROR', 'El valor debe ser mayor que 0, con máximo 2 decimales');
  }
  return amount;
}

// ------------------------------------------------------------ categorías

export async function listCategories(includeInactive = true) {
  const rows = await prisma.expenseCategory.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
  });
  return rows.map((c) => ({ id: c.id, nombre: c.nombre, afectaResultado: c.afectaResultado, isActive: c.isActive }));
}

export async function createCategory(input: { nombre: unknown; afectaResultado?: unknown; actorId: string }) {
  const nombre = str(input.nombre, 120);
  if (!nombre) throw new ExpenseError('VALIDATION_ERROR', 'El nombre de la categoría es obligatorio');
  const exists = await prisma.expenseCategory.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' } } });
  if (exists) throw new ExpenseError('CONFLICT', 'Ya existe una categoría con ese nombre', 409);
  const max = await prisma.expenseCategory.aggregate({ _max: { orden: true } });
  const created = await prisma.expenseCategory.create({
    data: { nombre, afectaResultado: input.afectaResultado === false ? false : true, orden: (max._max.orden ?? 0) + 1 },
  });
  await recordAudit({ actorId: input.actorId, action: 'expense_category.created', entityType: 'expense_category', entityId: created.id, after: { nombre, afectaResultado: created.afectaResultado } });
  return created;
}

export async function updateCategory(id: string, input: { nombre?: unknown; afectaResultado?: unknown; isActive?: unknown; actorId: string }) {
  const current = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!current) throw new ExpenseError('NOT_FOUND', 'Categoría no encontrada', 404);
  const data: Prisma.ExpenseCategoryUpdateInput = {};
  if (input.nombre !== undefined) {
    const nombre = str(input.nombre, 120);
    if (!nombre) throw new ExpenseError('VALIDATION_ERROR', 'El nombre no puede estar vacío');
    const dup = await prisma.expenseCategory.findFirst({ where: { id: { not: id }, nombre: { equals: nombre, mode: 'insensitive' } } });
    if (dup) throw new ExpenseError('CONFLICT', 'Ya existe una categoría con ese nombre', 409);
    data.nombre = nombre;
  }
  if (typeof input.afectaResultado === 'boolean') data.afectaResultado = input.afectaResultado;
  if (typeof input.isActive === 'boolean') data.isActive = input.isActive;
  const updated = await prisma.expenseCategory.update({ where: { id }, data });
  await recordAudit({
    actorId: input.actorId, action: 'expense_category.updated', entityType: 'expense_category', entityId: id,
    before: { nombre: current.nombre, afectaResultado: current.afectaResultado, isActive: current.isActive },
    after: { nombre: updated.nombre, afectaResultado: updated.afectaResultado, isActive: updated.isActive },
  });
  return updated;
}

// ---------------------------------------------------------------- gastos

function expenseInput(input: Record<string, unknown>) {
  return {
    fecha: new Date(`${assertDay(input.fecha, 'La fecha')}T00:00:00Z`),
    descripcion: str(input.descripcion, 500) ?? (() => { throw new ExpenseError('VALIDATION_ERROR', 'La descripción es obligatoria'); })(),
    valor: parseValor(input.valor),
    proveedor: str(input.proveedor, 255),
    medioPago: str(input.medioPago, 60),
    observaciones: str(input.observaciones, 2000),
    soporteReferencia: str(input.soporteReferencia, 500),
  };
}

async function activeCategory(id: unknown) {
  const category = await prisma.expenseCategory.findUnique({ where: { id: assertUuid(id, 'Categoría') } });
  if (!category || !category.isActive) throw new ExpenseError('VALIDATION_ERROR', 'La categoría no existe o está inactiva');
  return category;
}

export async function createExpense(input: Record<string, unknown>, actorId: string) {
  const data = expenseInput(input);
  const category = await activeCategory(input.categoryId);
  const created = await prisma.expense.create({ data: { ...data, categoryId: category.id, createdBy: actorId } });
  await recordAudit({ actorId, action: 'expense.created', entityType: 'expense', entityId: created.id, after: { valor: data.valor.toString(), categoria: category.nombre, fecha: input.fecha as string } });
  return created;
}

export async function updateExpense(id: string, input: Record<string, unknown>, actorId: string) {
  const current = await prisma.expense.findUnique({ where: { id } });
  if (!current) throw new ExpenseError('NOT_FOUND', 'Gasto no encontrado', 404);
  if (current.voidedAt) throw new ExpenseError('CONFLICT', 'Un gasto anulado no se puede editar', 409);
  const data = expenseInput(input);
  // Si la categoría no cambia no se exige que siga activa (puede haberse desactivado después del gasto).
  const categoryId = input.categoryId === undefined || input.categoryId === current.categoryId
    ? current.categoryId
    : (await activeCategory(input.categoryId)).id;
  const updated = await prisma.expense.update({ where: { id }, data: { ...data, categoryId } });
  await recordAudit({
    actorId, action: 'expense.updated', entityType: 'expense', entityId: id,
    before: { valor: current.valor.toString(), categoryId: current.categoryId, fecha: current.fecha.toISOString().slice(0, 10) },
    after: { valor: data.valor.toString(), categoryId, fecha: data.fecha.toISOString().slice(0, 10) },
  });
  return updated;
}

export async function voidExpense(id: string, reason: unknown, actorId: string) {
  const motivo = str(reason, 500);
  if (!motivo || motivo.length < 3) throw new ExpenseError('VALIDATION_ERROR', 'El motivo de anulación es obligatorio');
  const res = await prisma.expense.updateMany({ where: { id, voidedAt: null }, data: { voidedAt: new Date(), voidReason: motivo } });
  if (res.count === 0) {
    const exists = await prisma.expense.findUnique({ where: { id }, select: { voidedAt: true } });
    if (!exists) throw new ExpenseError('NOT_FOUND', 'Gasto no encontrado', 404);
    return { id, alreadyVoided: true };
  }
  await recordAudit({ actorId, action: 'expense.voided', entityType: 'expense', entityId: id, after: { motivo } });
  return { id, alreadyVoided: false };
}

export interface ExpenseFilters { from: string; to: string; categoryId?: string; q?: string; includeVoided?: boolean }

function where(filters: ExpenseFilters): Prisma.ExpenseWhereInput {
  const w: Prisma.ExpenseWhereInput = {
    fecha: { gte: new Date(`${assertDay(filters.from, 'La fecha inicial')}T00:00:00Z`), lte: new Date(`${assertDay(filters.to, 'La fecha final')}T00:00:00Z`) },
  };
  if (!filters.includeVoided) w.voidedAt = null;
  if (filters.categoryId) w.categoryId = assertUuid(filters.categoryId, 'Categoría');
  if (filters.q) w.OR = [
    { descripcion: { contains: filters.q, mode: 'insensitive' } },
    { proveedor: { contains: filters.q, mode: 'insensitive' } },
  ];
  return w;
}

const present = (e: Prisma.ExpenseGetPayload<{ include: { category: true } }>) => ({
  id: e.id, fecha: e.fecha.toISOString().slice(0, 10), descripcion: e.descripcion, valor: Number(e.valor),
  categoryId: e.categoryId, categoria: e.category.nombre, afectaResultado: e.category.afectaResultado,
  proveedor: e.proveedor, medioPago: e.medioPago, observaciones: e.observaciones, soporteReferencia: e.soporteReferencia,
  anulado: e.voidedAt !== null, motivoAnulacion: e.voidReason,
});

export async function listExpenses(filters: ExpenseFilters, query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);
  const w = where(filters);
  const [rows, total, sum] = await Promise.all([
    prisma.expense.findMany({ where: w, include: { category: true }, orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.expense.count({ where: w }),
    prisma.expense.aggregate({ where: { ...w, voidedAt: null }, _sum: { valor: true } }),
  ]);
  return { data: rows.map(present), meta: { ...buildMeta(page, pageSize, total), totalValor: Number(sum._sum.valor ?? 0) } };
}

/** Total de gastos que restan del resultado operativo en un rango de fechas (YYYY-MM-DD, inclusive). */
export async function sumOperatingExpenses(from: string, to: string): Promise<Prisma.Decimal> {
  const sum = await prisma.expense.aggregate({
    where: {
      voidedAt: null, category: { afectaResultado: true },
      fecha: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) },
    },
    _sum: { valor: true },
  });
  return sum._sum.valor ?? new Decimal(0);
}

const monthStart = (day: string) => `${day.slice(0, 8)}01`;
const addMonths = (day: string, delta: number) => {
  const d = new Date(`${monthStart(day)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 10);
};
const endOfMonth = (firstDay: string) => addMonths(firstDay, 1) && new Date(new Date(`${addMonths(firstDay, 1)}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);

export async function getExpenseSummary(from: string, to: string) {
  assertDay(from, 'La fecha inicial');
  assertDay(to, 'La fecha final');
  const base = { fecha: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) }, voidedAt: null };

  // Comparativo mensual: los últimos 6 meses terminando en el mes de `to`.
  const firstMonth = addMonths(to, -5);
  const [byCategory, monthly] = await Promise.all([
    prisma.expense.groupBy({ by: ['categoryId'], where: base, _sum: { valor: true }, _count: true }),
    prisma.$queryRaw<Array<{ month: string; total: unknown }>>`
      SELECT to_char(date_trunc('month', e.fecha), 'YYYY-MM') AS "month", COALESCE(SUM(e.valor), 0) AS "total"
      FROM expenses e JOIN expense_categories c ON c.id = e.category_id
      WHERE e.voided_at IS NULL AND e.fecha >= ${firstMonth}::date AND e.fecha <= ${endOfMonth(monthStart(to))}::date
      GROUP BY 1 ORDER BY 1 ASC
    `,
  ]);
  const categories = await prisma.expenseCategory.findMany({ where: { id: { in: byCategory.map((g) => g.categoryId) } } });
  const nameOf = new Map(categories.map((c) => [c.id, c]));
  const total = byCategory.reduce((sum, g) => sum.add(g._sum.valor ?? 0), new Decimal(0));

  const months = monthly.map((m) => ({ month: m.month, total: Number(m.total) }));
  const current = months.find((m) => m.month === to.slice(0, 7))?.total ?? 0;
  const previous = months.find((m) => m.month === addMonths(to, -1).slice(0, 7))?.total ?? 0;

  return {
    from, to, total: Number(total),
    porCategoria: byCategory
      .map((g) => ({
        categoryId: g.categoryId, categoria: nameOf.get(g.categoryId)?.nombre ?? '—', afectaResultado: nameOf.get(g.categoryId)?.afectaResultado ?? true,
        total: Number(g._sum.valor ?? 0), registros: g._count,
        participacionPct: total.isZero() ? null : Number(new Decimal(g._sum.valor ?? 0).div(total).mul(100).toDecimalPlaces(1)),
      }))
      .sort((a, b) => b.total - a.total),
    mensual: months,
    comparativoMensual: {
      mesActual: current, mesAnterior: previous,
      variacionPct: previous ? Math.round(((current - previous) / previous) * 1000) / 10 : null,
    },
  };
}

const csvText = (value: unknown): string => {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export async function expensesToCsv(filters: ExpenseFilters): Promise<string> {
  const rows = await prisma.expense.findMany({ where: where({ ...filters, includeVoided: true }), include: { category: true }, orderBy: [{ fecha: 'asc' }], take: 20_000 });
  const header = ['Fecha', 'Descripción', 'Valor COP', 'Categoría', 'Proveedor', 'Medio de pago', 'Observaciones', 'Soporte', 'Estado'];
  const lines = rows.map((e) => [
    e.fecha.toISOString().slice(0, 10), csvText(e.descripcion), String(e.valor), csvText(e.category.nombre), csvText(e.proveedor),
    csvText(e.medioPago), csvText(e.observaciones), csvText(e.soporteReferencia), e.voidedAt ? 'Anulado' : 'Vigente',
  ]);
  return `﻿${[header, ...lines].map((r) => r.join(',')).join('\r\n')}\r\n`;
}
