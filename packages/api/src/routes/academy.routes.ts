import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/requireRole.js';
import * as academyService from '../services/academy.service.js';
import { success, error } from '../utils/response.js';

const router: IRouter = Router();

// ── Public: Course catalog ──────────────────────────────────────────

router.get('/courses', async (req, res, next) => {
  try {
    const userTier = (req as any).user?.tier;
    const courses = await academyService.listPublishedCourses(userTier);
    success(res, courses);
  } catch (err) {
    next(err);
  }
});

// ── Public: Course detail (requires auth) ───────────────────────────

router.get('/courses/:slug', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const userTier = (req as any).user?.tier;
    const slug = req.params.slug as string;
    const course = await academyService.getCourseDetail(slug, userId, userTier);
    if (!course) { error(res, 404, 'NOT_FOUND', 'Curso no encontrado'); return; }
    success(res, course);
  } catch (err) {
    next(err);
  }
});

// ── Unlock course (payment) ─────────────────────────────────────────

router.post('/courses/:id/unlock', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const courseId = req.params.id as string;
    const course = await academyService.getCourseForUnlock(courseId);
    if (!course || !course.isActive) {
      error(res, 404, 'NOT_FOUND', 'Curso no encontrado');
      return;
    }

    const hasAccess = await academyService.hasCourseAccess(userId, course.id);
    if (hasAccess) {
      error(res, 400, 'ALREADY_ACCESS', 'Ya tienes acceso a este curso');
      return;
    }

    // Create an order for the unlock
    const { prisma } = await import('../config/db.js');
    const orderNumber = `ACD-${Date.now().toString(36).toUpperCase()}`;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId,
        status: 'pending',
        tierAtPurchase: (req as any).user?.tier,
        descuentoAplicado: 0,
        subtotal: course.unlockPrice,
        total: course.unlockPrice,
        direccionEnvio: {},
        notas: `Desbloqueo curso: ${course.title}`,
        items: {
          create: {
            productId: course.id, // reused FK for academy unlock
            sku: `ACD-${course.slug}`,
            nombreProducto: `Acceso: ${course.title}`,
            cantidad: 1,
            precioUnitario: course.unlockPrice,
            precioBaseSnapshot: 0,
            subtotal: course.unlockPrice,
          },
        },
      },
      include: { items: true },
    });

    success(res, { orderId: order.id, orderNumber: order.orderNumber, total: Number(order.total) }, 201);
  } catch (err) {
    next(err);
  }
});

// ── Confirm unlock (called after payment confirmation) ──────────────

router.post('/courses/:id/confirm-unlock', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const courseId = req.params.id as string;
    const { orderId } = req.body;

    if (!orderId) {
      error(res, 400, 'VALIDATION', 'orderId es requerido');
      return;
    }

    const course = await academyService.getCourseForUnlock(courseId);
    if (!course) { error(res, 404, 'NOT_FOUND', 'Curso no encontrado'); return; }

    // Verify order belongs to user and is paid
    const { prisma } = await import('../config/db.js');
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId, status: { not: 'cancelled' } },
    });
    if (!order) {
      error(res, 404, 'ORDER_NOT_FOUND', 'Orden no encontrada');
      return;
    }

    await academyService.grantCourseAccess(userId, course.id, orderId);
    success(res, { access: true });
  } catch (err) {
    next(err);
  }
});

// ── Video progress ──────────────────────────────────────────────────

router.put('/videos/:id/progress', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const videoId = req.params.id as string;
    const progress = await academyService.markVideoWatched(userId, videoId);
    success(res, progress);
  } catch (err) {
    next(err);
  }
});

export default router;
