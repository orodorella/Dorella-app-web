import { Router, type IRouter } from 'express';
import { requireAuth, requireRole } from '../../middleware/requireRole.js';
import { success } from '../../utils/response.js';
import { getDashboardData } from '../../services/dashboard.service.js';

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

export default router;
