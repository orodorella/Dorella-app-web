import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/requireRole.js';
import { error, success } from '../utils/response.js';
import { CreateMercadoPagoPreferenceSchema } from '../validators/payment.schema.js';
import * as mercadoPagoService from '../services/mercadopago.service.js';

const router: IRouter = Router();

router.post('/mercadopago/preference', requireAuth, async (req, res, next) => {
  try {
    const input = CreateMercadoPagoPreferenceSchema.parse(req.body);
    const result = await mercadoPagoService.createPreferenceForOrder(input.orderId, req.user!.id);
    success(res, result, 201);
  } catch (err) {
    if (err instanceof mercadoPagoService.MercadoPagoError) {
      error(res, err.status, err.code, err.message, err.details);
      return;
    }
    next(err);
  }
});

router.post('/mercadopago/webhook', async (req, res, next) => {
  try {
    const dataDotId = firstString((req.query as Record<string, unknown>)['data.id']);
    const paymentId =
      dataDotId ||
      firstString(req.body?.data?.id) ||
      firstString(req.query.id) ||
      firstString(req.body?.id);

    const signatureHeader = firstString(req.headers['x-signature']);
    const requestId = firstString(req.headers['x-request-id']);

    const signatureValid = mercadoPagoService.verifyMercadoPagoWebhookSignature({
      signatureHeader,
      requestId,
      dataId: paymentId,
    });
    if (!signatureValid) {
      console.warn(`[SECURITY] Invalid Mercado Pago webhook signature from ${req.ip}`);
      error(res, 401, 'INVALID_SIGNATURE', 'Firma de webhook inválida.');
      return;
    }

    const eventType = firstString(req.body?.type) || firstString(req.body?.topic) || firstString(req.query.type) || firstString(req.query.topic);

    const result = await mercadoPagoService.handleWebhookNotification({ eventType, paymentId });
    success(res, result);
  } catch (err) {
    if (err instanceof mercadoPagoService.MercadoPagoError) {
      error(res, err.status, err.code, err.message);
      return;
    }
    next(err);
  }
});

router.get('/mercadopago/status/:orderId', requireAuth, async (req, res, next) => {
  try {
    const orderId = firstString(req.params.orderId);
    if (!orderId) {
      error(res, 400, 'INVALID_ORDER_ID', 'ID de orden inválido.');
      return;
    }

    const result = await mercadoPagoService.getOrderPaymentStatus(orderId, req.user!.id);
    success(res, result);
  } catch (err) {
    if (err instanceof mercadoPagoService.MercadoPagoError) {
      error(res, err.status, err.code, err.message);
      return;
    }
    next(err);
  }
});

function firstString(value: unknown) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const first = value.find((entry): entry is string => typeof entry === 'string');
    return first;
  }
  return undefined;
}

export default router;
