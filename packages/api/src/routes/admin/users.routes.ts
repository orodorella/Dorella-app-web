import { Router, type IRouter } from 'express';
import { requireAuth, requireRole } from '../../middleware/requireRole.js';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { parsePagination, buildMeta } from '../../utils/pagination.js';
import { success, error } from '../../utils/response.js';
import {
  confirmSensitiveUserChangeSchema,
  requestSensitiveUserChangeSchema,
} from '../../validators/admin-user-change-verification.schema.js';
import {
  confirmSensitiveUserChangeVerification,
  isAdminUserChangeVerificationError,
  requestSensitiveUserChangeVerification,
} from '../../services/admin-user-change-verification.service.js';

const router: IRouter = Router();

router.use(requireAuth);
router.use(requireRole('admin'));

function isProtectedApproverEmail(email: string) {
  if (!env.ROLE_CHANGE_APPROVER_EMAIL) return false;
  return email.trim().toLowerCase() === env.ROLE_CHANGE_APPROVER_EMAIL.trim().toLowerCase();
}

function handleVerificationError(res: Parameters<typeof success>[0], err: unknown) {
  if (!isAdminUserChangeVerificationError(err)) return false;
  error(res, err.status, err.code, err.message);
  return true;
}

router.get('/', async (req, res, next) => {
  try {
    const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
    const search = req.query.search as string | undefined;
    const tierFilter = req.query.tier as string | undefined;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { empresa: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tierFilter && ['detal', 'por_mayor', 'gran_mayor'].includes(tierFilter)) {
      where.tier = tierFilter;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          nombre: true,
          apellido: true,
          telefono: true,
          empresa: true,
          nit: true,
          ciudad: true,
          departamento: true,
          role: true,
          tier: true,
          isActive: true,
          totalComprasAcumulado: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    success(
      res,
      users.map((user) => ({
        ...user,
        totalComprasAcumulado: Number(user.totalComprasAcumulado),
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      })),
      200,
      buildMeta(page, pageSize, total),
    );
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        telefono: true,
        empresa: true,
        nit: true,
        direccion: true,
        ciudad: true,
        departamento: true,
        role: true,
        tier: true,
        isActive: true,
        totalComprasAcumulado: true,
        createdAt: true,
        updatedAt: true,
        orders: {
          select: { id: true, orderNumber: true, status: true, total: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) {
      error(res, 404, 'NOT_FOUND', 'Usuario no encontrado');
      return;
    }

    success(res, {
      ...user,
      totalComprasAcumulado: Number(user.totalComprasAcumulado),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      orders: user.orders.map((order) => ({
        ...order,
        total: Number(order.total),
        createdAt: order.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/request-change-verification', async (req, res, next) => {
  try {
    const input = requestSensitiveUserChangeSchema.parse(req.body);
    const result = await requestSensitiveUserChangeVerification({
      adminUser: {
        id: req.user!.id,
        email: req.user!.email,
        role: req.user!.role,
      },
      targetUserId: req.params.id,
      changeType: input.changeType,
      requestedValue: input.requestedValue,
    });

    success(res, result);
  } catch (err) {
    if (handleVerificationError(res, err)) return;
    next(err);
  }
});

router.post('/:id/confirm-change-verification', async (req, res, next) => {
  try {
    const input = confirmSensitiveUserChangeSchema.parse(req.body);
    const result = await confirmSensitiveUserChangeVerification({
      adminUser: {
        id: req.user!.id,
        email: req.user!.email,
        role: req.user!.role,
      },
      targetUserId: req.params.id,
      verificationId: input.verificationId,
      code: input.code,
    });

    success(res, result);
  } catch (err) {
    if (handleVerificationError(res, err)) return;
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user!.id) {
      error(res, 400, 'CANNOT_DELETE_SELF', 'No puedes eliminar tu propia cuenta.');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, isActive: true },
    });

    if (!user) {
      error(res, 404, 'NOT_FOUND', 'Usuario no encontrado');
      return;
    }

    if (isProtectedApproverEmail(user.email)) {
      error(res, 400, 'CANNOT_DELETE_APPROVER', 'No se puede eliminar la cuenta del usuario aprobador.');
      return;
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false, deactivatedAt: new Date(), deactivatedBy: req.user!.id },
      select: { id: true, isActive: true },
    });

    success(res, updated);
  } catch (err) {
    next(err);
  }
});

export default router;
