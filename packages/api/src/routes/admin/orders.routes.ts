import { Router, type IRouter } from 'express';
import { requireAuth, requireRole } from '../../middleware/requireRole.js';
import { CreateManualOrderSchema, OrderQuerySchema, UpdateOrderStatusSchema } from '../../validators/order.schema.js';
import * as orderService from '../../services/order.service.js';
import { success, error } from '../../utils/response.js';

const router: IRouter = Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/', async (req, res, next) => {
  try {
    const parsed = OrderQuerySchema.safeParse(req.query);
    const statusFilter = parsed.success ? parsed.data.status : undefined;
    const result = await orderService.getAdminOrders(req.query as Record<string, unknown>, statusFilter);
    success(res, result.data, 200, result.meta);
  } catch (err) {
    next(err);
  }
});

router.post('/manual', async (req, res, next) => {
  try {
    const input = CreateManualOrderSchema.parse(req.body);
    const order = await orderService.createManualOrder(req.user!.id, input);
    success(res, order, 201);
  } catch (err) {
    if (err instanceof orderService.OrderError) {
      const status = err.code === 'INSUFFICIENT_STOCK' ? 409 : 400;
      error(res, status, err.code, err.message);
      return;
    }
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const order = await orderService.getAdminOrderById(req.params.id);
    if (!order) {
      error(res, 404, 'NOT_FOUND', 'Orden no encontrada');
      return;
    }
    success(res, order);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = UpdateOrderStatusSchema.parse(req.body);
    const order = await orderService.updateOrderStatus(req.params.id, status);
    if (!order) {
      error(res, 404, 'NOT_FOUND', 'Orden no encontrada');
      return;
    }
    success(res, { id: order.id, status: order.status });
  } catch (err) {
    if (err instanceof orderService.OrderError) {
      error(res, 400, err.code, err.message);
      return;
    }
    next(err);
  }
});

// Records a WhatsApp/cash sale as paid outside the platform. Scoped to
// origen='whatsapp' orders only — online (Mercado Pago) orders must never
// have their payment approved by an admin click, only by the webhook/
// reconciliation path. Idempotent; never touches `status`.
router.post('/:id/mark-paid', async (req, res, next) => {
  try {
    const result = await orderService.markOrderPaidManually(req.params.id, req.user!.id);

    switch (result.outcome) {
      case 'not_found':
        error(res, 404, 'NOT_FOUND', 'Orden no encontrada');
        return;
      case 'not_manual_order':
        error(res, 409, 'NOT_MANUAL_ORDER', 'Solo los pedidos manuales (WhatsApp) pueden marcarse como pagados desde aquí.');
        return;
      case 'paid':
      case 'already_paid':
        success(res, {
          id: result.order.id,
          orderNumber: result.order.orderNumber,
          status: result.order.status,
          paymentStatus: result.order.paymentStatus,
        });
        return;
    }
  } catch (err) {
    next(err);
  }
});

// Manual order confirmation — the only path allowed to move a pedido from
// "pendiente de confirmación" to "confirmado". Only succeeds when the
// payment is already approved; idempotent when the order is already
// confirmed.
router.post('/:id/confirm', async (req, res, next) => {
  try {
    const result = await orderService.confirmOrder(req.params.id);

    switch (result.outcome) {
      case 'not_found':
        error(res, 404, 'NOT_FOUND', 'Orden no encontrada');
        return;
      case 'payment_not_approved':
        error(res, 409, 'PAYMENT_NOT_APPROVED', 'No se puede confirmar un pedido sin pago aprobado.');
        return;
      case 'invalid_status':
        error(res, 409, 'INVALID_STATUS', 'Solo se pueden confirmar pedidos pendientes de confirmación.');
        return;
      case 'confirmed':
      case 'already_confirmed':
        success(res, {
          id: result.order.id,
          orderNumber: result.order.orderNumber,
          status: result.order.status,
          paymentStatus: result.order.paymentStatus,
        });
        return;
    }
  } catch (err) {
    next(err);
  }
});

export default router;
