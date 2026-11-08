import { Router, type IRouter, type Request } from 'express';
import type { Prisma } from '@prisma/client';
import { parsePagination, buildMeta } from '../../utils/pagination.js';
import { requireAuth } from '../../middleware/requireRole.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { hasPermission } from 'shared/src/constants/permissions.js';
import { canRoleSetOrderStatus } from 'shared/src/constants/order-status.js';
import { recordAudit } from '../../services/audit.service.js';
import { getCommercialDiscountLimit } from '../../services/settings.service.js';
import * as inventoryService from '../../services/inventory.service.js';
import { prisma } from '../../config/db.js';
import { CreateManualOrderSchema, OrderQuerySchema, UpdateOrderStatusSchema } from '../../validators/order.schema.js';
import * as orderService from '../../services/order.service.js';
import { renderOrderPdf } from '../../services/order-pdf.service.js';
import { success, error } from '../../utils/response.js';

import { z } from 'zod';
import { changeCustomerTier, CustomerTierError } from '../../services/customer-tier.service.js';

const ChangeCustomerTierSchema = z.object({ tier: z.enum(['detal', 'por_mayor', 'gran_mayor']) });

const router: IRouter = Router();

router.use(requireAuth);

// Bodega prepara pedidos: ve productos y cantidades, pero no precios, descuentos ni totales.
function ocultaPrecios(req: Request): boolean {
  return !hasPermission(req.user!.role, 'finance:read') && !hasPermission(req.user!.role, 'orders:create');
}

function sinPrecios<T extends { items?: Array<Record<string, unknown>> }>(order: T): T {
  return {
    ...order,
    subtotal: null, total: null, descuentoAplicado: null,
    items: order.items?.map((item) => ({ ...item, precioUnitario: null, subtotal: null, descuentoAdicional: null })),
  };
}

// Quien no puede ver todas las órdenes (comercial) solo ve las que él vendió.
function orderScope(req: Request): orderService.OrderScope {
  return hasPermission(req.user!.role, 'orders:read_all') ? {} : { sellerId: req.user!.id };
}

// Búsquedas mínimas para armar un pedido manual. Reemplazan el uso de
// /api/admin/products y /api/admin/users, que son de uso exclusivo de
// administración y devuelven más campos de los que necesita un vendedor.
router.get('/lookup/products', requirePermission('orders:create'), async (req, res, next) => {
  try {
    const result = await inventoryService.getAdminProducts(req.query as Record<string, unknown>);
    const data = result.data.map((p) => ({
      id: p.id, sku: p.sku, nombre: p.nombre, precio: p.precio, imagenes: p.imagenes,
      stock: p.stock, stockReservado: p.stockReservado, disponible: p.disponible, isActive: p.isActive, categoria: p.categoria,
    }));
    success(res, data, 200, result.meta);
  } catch (err) {
    next(err);
  }
});

// Datos maestros reales de UN cliente para autocompletar el formulario (no se confía en lo que
// trajo la búsqueda). Solo lectura; el pedido guarda su propia copia de la entrega.
// Tope de descuento adicional por línea para quien arma pedidos (admin: 100).
router.get('/lookup/discount-limit', requirePermission('orders:create'), async (req, res, next) => {
  try {
    const sinTope = hasPermission(req.user!.role, 'finance:read');
    success(res, { maxDescuentoAdicional: sinTope ? 100 : await getCommercialDiscountLimit() });
  } catch (err) {
    next(err);
  }
});

// El comercial puede subir/bajar el nivel de un CLIENTE (no de personal del panel).
router.patch('/lookup/customers/:id/tier', requirePermission('customers:change_tier'), async (req, res, next) => {
  try {
    const parsed = ChangeCustomerTierSchema.safeParse(req.body);
    if (!parsed.success) {
      error(res, 400, 'VALIDATION_ERROR', 'Nivel inválido');
      return;
    }
    const updated = await changeCustomerTier(String(req.params.id), parsed.data.tier, req.user!.id, {
      reason: 'comercial_manual',
    });
    success(res, updated);
  } catch (err) {
    if (err instanceof CustomerTierError) {
      error(res, err.status, err.code, err.message);
      return;
    }
    next(err);
  }
});

router.get('/lookup/customers/:id', requirePermission('orders:create'), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      error(res, 400, 'VALIDATION_ERROR', 'Cliente inválido');
      return;
    }
    const user = await prisma.user.findFirst({
      where: { id, isActive: true, role: 'cliente' },
      select: {
        id: true, email: true, nombre: true, apellido: true, telefono: true, empresa: true,
        direccion: true, ciudad: true, departamento: true, tier: true, isActive: true,
      },
    });
    if (!user) {
      error(res, 404, 'NOT_FOUND', 'Cliente no encontrado');
      return;
    }
    success(res, user);
  } catch (err) {
    next(err);
  }
});

router.get('/lookup/customers', requirePermission('orders:create'), async (req, res, next) => {
  try {
    const { page, pageSize: requestedSize } = parsePagination(req.query as Record<string, unknown>);
    const pageSize = Math.min(requestedSize, 10);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    // Evita recorrer la cartera completa: se exige un término de búsqueda.
    if (search.length < 3) {
      success(res, [], 200, buildMeta(page, pageSize, 0));
      return;
    }
    const where: Prisma.UserWhereInput = { isActive: true, role: 'cliente' };
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { apellido: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { empresa: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, nombre: true, apellido: true, telefono: true, empresa: true,
          direccion: true, ciudad: true, departamento: true, tier: true, isActive: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);
    success(res, users, 200, buildMeta(page, pageSize, total));
  } catch (err) {
    next(err);
  }
});

router.get('/', requirePermission('orders:read_all', 'orders:read_own'), async (req, res, next) => {
  try {
    const parsed = OrderQuerySchema.safeParse(req.query);
    const statusFilter = parsed.success ? parsed.data.status : undefined;
    const result = await orderService.getAdminOrders(req.query as Record<string, unknown>, statusFilter, orderScope(req));
    success(res, ocultaPrecios(req) ? result.data.map(sinPrecios) : result.data, 200, result.meta);
  } catch (err) {
    next(err);
  }
});

router.post('/manual', requirePermission('orders:create'), async (req, res, next) => {
  try {
    const input = CreateManualOrderSchema.parse(req.body);
    // Quien no tiene acceso financiero (comercial) no puede dar descuentos por encima del tope administrable.
    if (!hasPermission(req.user!.role, 'finance:read')) {
      const tope = await getCommercialDiscountLimit();
      const mayor = Math.max(0, ...input.items.map((item) => item.descuentoAdicional));
      if (mayor > tope) {
        error(res, 400, 'DISCOUNT_LIMIT_EXCEEDED', `El descuento adicional máximo permitido es ${tope}%. Pide autorización al administrador.`);
        return;
      }
    }
    const order = await orderService.createManualOrder(req.user!.id, input, req.user!.role);
    await recordAudit({
      actorId: req.user!.id,
      action: 'order.manual_created',
      entityType: 'order',
      entityId: order.id,
      after: {
        orderNumber: order.orderNumber,
        sellerId: req.user!.id,
        sellerRole: req.user!.role,
        maxDescuentoAdicional: Math.max(0, ...input.items.map((item) => item.descuentoAdicional)),
      },
    });
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

router.get('/:id', requirePermission('orders:read_all', 'orders:read_own'), async (req, res, next) => {
  try {
    const order = await orderService.getAdminOrderById(String(req.params.id), orderScope(req));
    if (!order) {
      error(res, 404, 'NOT_FOUND', 'Orden no encontrada');
      return;
    }
    success(res, ocultaPrecios(req) ? sinPrecios(order) : order);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/pdf', requirePermission('orders:read_all', 'orders:read_own'), async (req, res, next) => {
  try {
    if (ocultaPrecios(req)) {
      error(res, 403, 'FORBIDDEN', 'La factura contiene precios y no está disponible para este rol');
      return;
    }
    const order = await orderService.getAdminOrderForPdfById(String(req.params.id), orderScope(req));
    if (!order) {
      error(res, 404, 'NOT_FOUND', 'Orden no encontrada');
      return;
    }
    const buffer = await renderOrderPdf(order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="pedido-${order.orderNumber}.pdf"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', requirePermission('orders:update_status'), async (req, res, next) => {
  try {
    const { status, guia } = UpdateOrderStatusSchema.parse(req.body);
    // orders:update_status es un permiso amplio (admin/bodega/comercial);
    // qué estado puede fijar cada rol es una regla más fina (bodega prepara/
    // despacha, comercial solo confirma/cancela sus propios pedidos) que vive
    // en shared para que la UI y la API usen exactamente la misma tabla.
    if (!canRoleSetOrderStatus(req.user!.role, status)) {
      error(res, 403, 'FORBIDDEN', 'Tu rol no puede fijar ese estado.');
      return;
    }
    const order = await orderService.updateOrderStatus(String(req.params.id), status, orderScope(req), { guia });
    if (!order) {
      error(res, 404, 'NOT_FOUND', 'Orden no encontrada');
      return;
    }
    await recordAudit({ actorId: req.user!.id, action: 'order.status_changed', entityType: 'order', entityId: order.id, after: { status: order.status, actorRole: req.user!.role } });
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
// reconciliation path. Idempotent. Available to admin and to comercial, but
// only over orders where comercial is the seller (orderScope); al aprobar el
// pago, el pedido pasa a Confirmado en la misma transacción (ver order.service).
router.post('/:id/mark-paid', requirePermission('orders:mark_paid'), async (req, res, next) => {
  try {
    const result = await orderService.markOrderPaidManually(String(req.params.id), req.user!.id, orderScope(req));

    switch (result.outcome) {
      case 'not_found':
        error(res, 404, 'NOT_FOUND', 'Orden no encontrada');
        return;
      case 'not_manual_order':
        error(res, 409, 'NOT_MANUAL_ORDER', 'Solo los pedidos manuales (WhatsApp) pueden marcarse como pagados desde aquí.');
        return;
      case 'insufficient_stock':
        error(
          res,
          409,
          'INSUFFICIENT_STOCK',
          'No hay suficiente inventario disponible para marcar este pedido como pagado. Revisa el stock de los productos antes de continuar.',
          result.unavailable.map((item) => ({
            field: item.sku,
            message: `${item.nombre}: solicitado ${item.requested}, disponible ${item.available}`,
          })),
        );
        return;
      case 'paid':
      case 'already_paid':
        if (result.outcome === 'paid') {
          await recordAudit({
            actorId: req.user!.id,
            action: 'order.marked_paid',
            entityType: 'order',
            entityId: result.order.id,
            after: { orderNumber: result.order.orderNumber, status: result.order.status, actorRole: req.user!.role },
          });
        }
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
router.post('/:id/confirm', requirePermission('orders:update_status'), async (req, res, next) => {
  try {
    const result = await orderService.confirmOrder(String(req.params.id), orderScope(req));

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
