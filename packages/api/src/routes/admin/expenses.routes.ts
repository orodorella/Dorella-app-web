import { Router, type IRouter, type Response } from 'express';
import { requireAuth } from '../../middleware/requireRole.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { success, error } from '../../utils/response.js';
import * as expenses from '../../services/expense.service.js';
import { CommissionError, assertDay, assertUuid, todayInBogota } from '../../services/commission.service.js';

const router: IRouter = Router();

router.use(requireAuth);
// Gastos del negocio: información financiera, solo quien administra gastos (admin).
router.use(requirePermission('expenses:manage'));

function handle(res: Response, err: unknown, next: (e?: unknown) => void) {
  if (err instanceof CommissionError) {
    error(res, err.status, err.code, err.message);
    return;
  }
  next(err);
}

const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined);

function filtersOf(query: Record<string, unknown>): expenses.ExpenseFilters {
  const today = todayInBogota();
  return {
    from: text(query.from) ?? `${today.slice(0, 8)}01`,
    to: text(query.to) ?? today,
    categoryId: text(query.categoryId),
    q: text(query.q)?.slice(0, 100),
  };
}

router.get('/categories', async (_req, res, next) => {
  try {
    success(res, await expenses.listCategories());
  } catch (err) {
    handle(res, err, next);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const created = await expenses.createCategory({ nombre: req.body?.nombre, afectaResultado: req.body?.afectaResultado, actorId: req.user!.id });
    success(res, { id: created.id, nombre: created.nombre }, 201);
  } catch (err) {
    handle(res, err, next);
  }
});

router.patch('/categories/:id', async (req, res, next) => {
  try {
    const updated = await expenses.updateCategory(assertUuid(req.params.id, 'Categoría'), { ...req.body, actorId: req.user!.id });
    success(res, { id: updated.id, nombre: updated.nombre, isActive: updated.isActive, afectaResultado: updated.afectaResultado });
  } catch (err) {
    handle(res, err, next);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const f = filtersOf(req.query as Record<string, unknown>);
    success(res, await expenses.getExpenseSummary(f.from, f.to));
  } catch (err) {
    handle(res, err, next);
  }
});

router.get('/export', async (req, res, next) => {
  try {
    const f = filtersOf(req.query as Record<string, unknown>);
    assertDay(f.from, 'La fecha inicial');
    assertDay(f.to, 'La fecha final');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="gastos-${f.from}_${f.to}.csv"`);
    res.send(await expenses.expensesToCsv(f));
  } catch (err) {
    handle(res, err, next);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const result = await expenses.listExpenses(filtersOf(req.query as Record<string, unknown>), req.query as Record<string, unknown>);
    success(res, result.data, 200, result.meta);
  } catch (err) {
    handle(res, err, next);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const created = await expenses.createExpense(req.body ?? {}, req.user!.id);
    success(res, { id: created.id }, 201);
  } catch (err) {
    handle(res, err, next);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const updated = await expenses.updateExpense(assertUuid(req.params.id, 'Gasto'), req.body ?? {}, req.user!.id);
    success(res, { id: updated.id });
  } catch (err) {
    handle(res, err, next);
  }
});

router.post('/:id/void', async (req, res, next) => {
  try {
    success(res, await expenses.voidExpense(assertUuid(req.params.id, 'Gasto'), req.body?.motivo, req.user!.id));
  } catch (err) {
    handle(res, err, next);
  }
});

export default router;
