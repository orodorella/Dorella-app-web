import { Router, type IRouter, type Response } from 'express';
import { requireAuth } from '../../middleware/requireRole.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { success, error } from '../../utils/response.js';
import * as commissions from '../../services/commission.service.js';

const router: IRouter = Router();

router.use(requireAuth);
// Comisiones: solo quien administra comisiones (admin). Un comercial nunca ve ni cambia porcentajes.
router.use(requirePermission('commissions:manage'));

function handle(res: Response, err: unknown, next: (e?: unknown) => void) {
  if (err instanceof commissions.CommissionError) {
    error(res, err.status, err.code, err.message);
    return;
  }
  next(err);
}

const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined);

router.get('/rules', async (_req, res, next) => {
  try {
    success(res, await commissions.listRules());
  } catch (err) {
    handle(res, err, next);
  }
});

router.put('/rules', async (req, res, next) => {
  try {
    const rule = await commissions.setCommissionRule({
      tier: req.body?.tier,
      userId: req.body?.userId === undefined || req.body?.userId === null ? null : commissions.assertUuid(req.body.userId, 'Comercial'),
      porcentaje: req.body?.porcentaje,
      actorId: req.user!.id,
    });
    success(res, { id: rule.id, tier: rule.tier, userId: rule.userId, porcentaje: Number(rule.porcentaje) });
  } catch (err) {
    handle(res, err, next);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const today = commissions.todayInBogota();
    const from = text(req.query.from) ?? `${today.slice(0, 8)}01`;
    const to = text(req.query.to) ?? today;
    success(res, await commissions.getCommissionSummary(from, to));
  } catch (err) {
    handle(res, err, next);
  }
});

router.get('/liquidations', async (req, res, next) => {
  try {
    success(res, await commissions.listLiquidations({ sellerId: text(req.query.sellerId) ? commissions.assertUuid(req.query.sellerId, 'Comercial') : undefined, status: text(req.query.status) }));
  } catch (err) {
    handle(res, err, next);
  }
});

router.post('/liquidations', async (req, res, next) => {
  try {
    const liquidation = await commissions.createLiquidation({
      sellerId: commissions.assertUuid(req.body?.sellerId, 'Comercial'),
      from: String(req.body?.from ?? ''),
      to: String(req.body?.to ?? ''),
      notas: typeof req.body?.notas === 'string' ? req.body.notas.slice(0, 1000) : undefined,
      actorId: req.user!.id,
    });
    success(res, { id: liquidation.id, total: Number(liquidation.total), status: liquidation.status }, 201);
  } catch (err) {
    handle(res, err, next);
  }
});

router.get('/liquidations/:id', async (req, res, next) => {
  try {
    success(res, await commissions.getLiquidationDetail(commissions.assertUuid(req.params.id, 'Liquidación')));
  } catch (err) {
    handle(res, err, next);
  }
});

router.get('/liquidations/:id/export', async (req, res, next) => {
  try {
    const detail = await commissions.getLiquidationDetail(commissions.assertUuid(req.params.id, 'Liquidación'));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="liquidacion-${detail.periodFrom}_${detail.periodTo}.csv"`);
    res.send(commissions.liquidationToCsv(detail));
  } catch (err) {
    handle(res, err, next);
  }
});

router.post('/liquidations/:id/pay', async (req, res, next) => {
  try {
    const liquidation = await commissions.markLiquidationPaid(commissions.assertUuid(req.params.id, 'Liquidación'), req.user!.id);
    success(res, { id: liquidation.id, status: liquidation.status, paidAt: liquidation.paidAt });
  } catch (err) {
    handle(res, err, next);
  }
});

router.post('/adjustments', async (req, res, next) => {
  try {
    const adjustment = await commissions.addAdjustment({
      sellerId: commissions.assertUuid(req.body?.sellerId, 'Comercial'),
      monto: req.body?.monto,
      motivo: req.body?.motivo,
      actorId: req.user!.id,
    });
    success(res, { id: adjustment.id, monto: Number(adjustment.monto) }, 201);
  } catch (err) {
    handle(res, err, next);
  }
});

export default router;
