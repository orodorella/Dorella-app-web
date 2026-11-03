import { Router, type IRouter } from 'express';
import { requireAuth } from '../../middleware/requireRole.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { success } from '../../utils/response.js';
import { ALL_DASHBOARD_SECTIONS, type DashboardSection, getOperationalDashboard, getDashboardData, getRestockAlerts, getSlowMovers, getTierUpgrades } from '../../services/dashboard.service.js';

const router: IRouter = Router();
router.use(requireAuth);

// Vista operativa (bodega y admin): inventario y estado de pedidos, sin ingresos.
router.get('/operational', requirePermission('dashboard:operational'), async (_req, res, next) => {
  try {
    success(res, await getOperationalDashboard());
  } catch (err) {
    next(err);
  }
});

// Todo lo demás incluye ingresos/clientes: solo quien tenga acceso financiero.
router.use(requirePermission('dashboard:financial'));

router.get('/', async (req, res, next) => {
  try {
    const requested = Number(req.query.days);
    const days = Number.isInteger(requested) ? requested : 30;
    // ?sections=core,charts,inventory permite a la pantalla pedir y pintar por partes (por defecto, todo).
    const sectionList = typeof req.query.sections === 'string'
      ? req.query.sections.split(',').filter((x): x is DashboardSection => (ALL_DASHBOARD_SECTIONS as string[]).includes(x))
      : ALL_DASHBOARD_SECTIONS;
    const data = await getDashboardData(days, sectionList.length > 0 ? sectionList : ALL_DASHBOARD_SECTIONS);
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
