import { Router, type IRouter } from 'express';
import { requireAuth, requireRole } from '../../middleware/requireRole.js';
import { success } from '../../utils/response.js';
import { getDashboardData, getRestockAlerts, getSlowMovers, getTierUpgrades } from '../../services/dashboard.service.js';

const router: IRouter = Router();
router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/', async (req, res, next) => {
  try {
    const requested = Number(req.query.days);
    const days = Number.isInteger(requested) ? requested : 30;
    const data = await getDashboardData(days);
    success(res, data);
  } catch (err) {
    next(err);
  }
});

router.get('/slow-movers', async (req, res, next) => {
  try {
    const result = await getSlowMovers(req.query as Record<string, unknown>);
    success(res, result.data, 200, result.meta);
  } catch (err) {
    next(err);
  }
});

router.get('/tier-upgrades', async (req, res, next) => {
  try {
    const requested = Number(req.query.days);
    const days = Number.isInteger(requested) ? requested : 30;
    const result = await getTierUpgrades(req.query as Record<string, unknown>, days);
    success(res, result.data, 200, result.meta);
  } catch (err) {
    next(err);
  }
});

router.get('/restock-alerts', async (req, res, next) => {
  try {
    const requested = Number(req.query.days);
    const days = Number.isInteger(requested) ? requested : 30;
    const result = await getRestockAlerts(req.query as Record<string, unknown>, days);
    success(res, result.data, 200, result.meta);
  } catch (err) {
    next(err);
  }
});

export default router;
