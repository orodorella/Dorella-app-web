import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/requireRole.js';
import { CreateOrderSchema } from '../validators/order.schema.js';
import * as orderService from '../services/order.service.js';
import { success, error } from '../utils/response.js';

const router: IRouter = Router();

router.use(requireAuth);

router.post('/', async (req, res, next) => {
  try {
    const input = CreateOrderSchema.parse(req.body);
    const result = await orderService.createOrder(req.user!.id, input, req.user!.tier);

    success(res, {
      order: result.order,
      tierUpgraded: result.tierUpgrade.upgraded,
      newTier: result.tierUpgrade.newTier,
    }, 201);
  } catch (err) {
    if (err instanceof orderService.OrderError) {
      error(res, 400, err.code, err.message);
      return;
    }
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const result = await orderService.getOrders(req.user!.id, req.query as Record<string, unknown>);
    success(res, result.data, 200, result.meta);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.user!.id, req.params.id);
    if (!order) {
      error(res, 404, 'NOT_FOUND', 'Orden no encontrada');
      return;
    }
    success(res, order);
  } catch (err) {
    next(err);
  }
});

export default router;
