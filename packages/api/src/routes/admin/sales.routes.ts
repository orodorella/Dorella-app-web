import { Router, type IRouter } from 'express';
import { requireAuth } from '../../middleware/requireRole.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { success, error } from '../../utils/response.js';
import {
  SalesFilterError,
  getCommercialPerformance,
  listSellers,
  parseSalesFilters,
} from '../../services/sales-report.service.js';

const router: IRouter = Router();

router.use(requireAuth);
// Cifras de venta por comercial: solo acceso financiero (admin).
router.use(requirePermission('finance:read'));

router.get('/performance', async (req, res, next) => {
  try {
    const filters = parseSalesFilters(req.query as Record<string, unknown>);
    success(res, await getCommercialPerformance(filters));
  } catch (err) {
    if (err instanceof SalesFilterError) {
      error(res, 400, 'VALIDATION_ERROR', err.message);
      return;
    }
    next(err);
  }
});

router.get('/sellers', async (_req, res, next) => {
  try {
    success(res, await listSellers());
  } catch (err) {
    next(err);
  }
});

export default router;
