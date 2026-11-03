import { Router, type IRouter, type Response } from 'express';
import { requireAuth } from '../../middleware/requireRole.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { success, error } from '../../utils/response.js';
import * as costs from '../../services/cost.service.js';
import { CommissionError, assertDay, assertUuid, todayInBogota } from '../../services/commission.service.js';
import * as lots from '../../services/lot.service.js';
import { getCommercialDiscountLimit, setCommercialDiscountLimit } from '../../services/settings.service.js';
import { SalesFilterError } from '../../services/sales-report.service.js';
import { financialDashboardToCsv, getFinancialDashboard } from '../../services/finance-dashboard.service.js';

const router: IRouter = Router();

router.use(requireAuth);
// Costos, márgenes y rentabilidad: información confidencial, solo acceso financiero (admin).
router.use(requirePermission('finance:read'));

function handle(res: Response, err: unknown, next: (e?: unknown) => void) {
  if (err instanceof CommissionError) {
    error(res, err.status, err.code, err.message);
    return;
  }
  if (err instanceof SalesFilterError) {
    error(res, 400, 'VALIDATION_ERROR', err.message);
    return;
  }
  next(err);
}

const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined);

router.get('/costs/products', async (req, res, next) => {
  try {
    const result = await costs.listProductCosts(req.query as Record<string, unknown>);
    success(res, result.data, 200, result.meta);
  } catch (err) {
    handle(res, err, next);
  }
});

router.put('/costs/products/:id', async (req, res, next) => {
  try {
    const created = await costs.setProductCost({
      productId: assertUuid(req.params.id, 'Producto'),
      costoAdquisicion: req.body?.costoAdquisicion,
      costoAdicional: req.body?.costoAdicional,
      validFrom: req.body?.validFrom,
      notas: req.body?.notas,
      actorId: req.user!.id,
    });
    success(res, { id: created.id, costoTotal: Number(created.costoTotal) }, 201);
  } catch (err) {
    handle(res, err, next);
  }
});

router.get('/costs/products/:id/history', async (req, res, next) => {
  try {
    success(res, await costs.getCostHistory(assertUuid(req.params.id, 'Producto')));
  } catch (err) {
    handle(res, err, next);
  }
});

router.post('/costs/backfill', async (req, res, next) => {
  try {
    success(res, await costs.backfillOrderCosts(req.user!.id));
  } catch (err) {
    handle(res, err, next);
  }
});

router.get('/settings/discount-limit', async (_req, res, next) => {
  try {
    success(res, { maxDescuentoAdicional: await getCommercialDiscountLimit() });
  } catch (err) {
    handle(res, err, next);
  }
});

router.put('/settings/discount-limit', async (req, res, next) => {
  try {
    success(res, { maxDescuentoAdicional: await setCommercialDiscountLimit(req.body?.maxDescuentoAdicional, req.user!.id) });
  } catch (err) {
    handle(res, err, next);
  }
});

router.post('/inventory/purchases', async (req, res, next) => {
  try {
    const result = await lots.registerPurchase({ ...(req.body ?? {}), actorId: req.user!.id });
    success(res, { id: result.lot.id, cantidad: result.lot.cantidad, costoUnitarioEfectivo: Number(result.lot.costoUnitarioEfectivo), duplicado: result.duplicate }, result.duplicate ? 200 : 201);
  } catch (err) {
    handle(res, err, next);
  }
});

router.get('/inventory/costing-status', async (_req, res, next) => {
  try {
    success(res, await lots.getCostingStatus());
  } catch (err) {
    handle(res, err, next);
  }
});

router.get('/inventory/valuation', async (req, res, next) => {
  try {
    const today = todayInBogota();
    success(res, await lots.getInventoryValuation(text(req.query.from) ?? `${today.slice(0, 8)}01`, text(req.query.to) ?? today));
  } catch (err) {
    handle(res, err, next);
  }
});

router.get('/inventory/products/:id/history', async (req, res, next) => {
  try {
    success(res, await lots.getProductCostHistory(String(req.params.id)));
  } catch (err) {
    handle(res, err, next);
  }
});

router.post('/inventory/lots/:id/adjust', async (req, res, next) => {
  try {
    success(res, await lots.adjustLot(assertUuid(req.params.id, 'Lote'), { cantidadRestante: req.body?.cantidadRestante, motivo: req.body?.motivo, actorId: req.user!.id }));
  } catch (err) {
    handle(res, err, next);
  }
});

router.get('/profitability', async (req, res, next) => {
  try {
    const today = todayInBogota();
    const sellerId = text(req.query.sellerId);
    const categoryId = text(req.query.categoryId);
    const tier = text(req.query.tier);
    if (sellerId && sellerId !== 'sin-asignar') assertUuid(sellerId, 'Comercial');
    if (categoryId) assertUuid(categoryId, 'Categoría');
    if (tier && !['detal', 'por_mayor', 'gran_mayor'].includes(tier)) {
      error(res, 400, 'VALIDATION_ERROR', 'Modalidad inválida');
      return;
    }
    success(res, await costs.getProfitability({
      from: text(req.query.from) ?? `${today.slice(0, 8)}01`,
      to: text(req.query.to) ?? today,
      sellerId, categoryId, tier,
    }));
  } catch (err) {
    handle(res, err, next);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const today = todayInBogota();
    const from = text(req.query.from) ?? `${today.slice(0, 8)}01`;
    const to = text(req.query.to) ?? today;
    success(res, await getFinancialDashboard(from, to));
  } catch (err) {
    handle(res, err, next);
  }
});

router.get('/summary/export', async (req, res, next) => {
  try {
    const today = todayInBogota();
    const from = text(req.query.from) ?? `${today.slice(0, 8)}01`;
    const to = text(req.query.to) ?? today;
    assertDay(from, 'La fecha inicial');
    assertDay(to, 'La fecha final');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="resumen-financiero-${from}_${to}.csv"`);
    res.send(financialDashboardToCsv(await getFinancialDashboard(from, to)));
  } catch (err) {
    handle(res, err, next);
  }
});

export default router;
