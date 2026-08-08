import { Router, type IRouter } from 'express';
import { requireAuth, requireRole } from '../../middleware/requireRole.js';
import { prisma } from '../../config/db.js';
import { parsePagination, buildMeta } from '../../utils/pagination.js';
import { success, error } from '../../utils/response.js';
import { z } from 'zod';

const router: IRouter = Router();
router.use(requireAuth);
router.use(requireRole('admin'));

const ChangeTierSchema = z.object({
  tier: z.enum(['detal', 'por_mayor', 'gran_mayor']),
});

const ChangeRoleSchema = z.object({
  role: z.enum(['cliente', 'admin']),
});

// The only account allowed to grant or revoke the 'admin' role. Any other
// admin trying to assign roles gets a 403 — regular admins can still manage
// tiers and deactivate users, just not the admin role itself.
const SUPERADMIN_EMAIL = 'admin.dorella@gmail.com';

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
          id: true, email: true, nombre: true, apellido: true, telefono: true,
          empresa: true, nit: true, ciudad: true, departamento: true,
          role: true, tier: true, isActive: true, totalComprasAcumulado: true,
          createdAt: true, updatedAt: true,
        },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    const data = users.map((u) => ({
      ...u,
      totalComprasAcumulado: Number(u.totalComprasAcumulado),
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }));

    success(res, data, 200, buildMeta(page, pageSize, total));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, email: true, nombre: true, apellido: true, telefono: true,
        empresa: true, nit: true, direccion: true, ciudad: true, departamento: true,
        role: true, tier: true, isActive: true, totalComprasAcumulado: true,
        createdAt: true, updatedAt: true,
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
      orders: user.orders.map((o) => ({
        ...o,
        total: Number(o.total),
        createdAt: o.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/tier', async (req, res, next) => {
  try {
    const { tier: newTier } = ChangeTierSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, tier: true },
    });

    if (!user) {
      error(res, 404, 'NOT_FOUND', 'Usuario no encontrado');
      return;
    }

    if (user.tier === newTier) {
      error(res, 400, 'SAME_TIER', 'El usuario ya tiene este tier');
      return;
    }

    const [updated] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.params.id },
        data: { tier: newTier, tierChangedAt: new Date() },
        select: { id: true, email: true, nombre: true, tier: true },
      }),
      prisma.tierChangeLog.create({
        data: {
          userId: req.params.id,
          oldTier: user.tier,
          newTier,
          reason: 'admin_manual',
          changedBy: req.user!.id,
        },
      }),
    ]);

    success(res, updated);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/role', async (req, res, next) => {
  try {
    if (req.user!.email !== SUPERADMIN_EMAIL) {
      error(res, 403, 'FORBIDDEN', 'Solo el superadmin puede asignar o quitar el rol de administrador.');
      return;
    }

    const { role: newRole } = ChangeRoleSchema.parse(req.body);

    if (req.params.id === req.user!.id) {
      error(res, 400, 'CANNOT_CHANGE_OWN_ROLE', 'No puedes cambiar tu propio rol.');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      error(res, 404, 'NOT_FOUND', 'Usuario no encontrado');
      return;
    }

    if (user.email === SUPERADMIN_EMAIL) {
      error(res, 400, 'CANNOT_CHANGE_SUPERADMIN_ROLE', 'No se puede cambiar el rol del superadmin.');
      return;
    }

    if (user.role === newRole) {
      error(res, 400, 'SAME_ROLE', 'El usuario ya tiene este rol');
      return;
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: newRole },
      select: { id: true, email: true, nombre: true, role: true },
    });

    success(res, updated);
  } catch (err) {
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

    if (user.email === SUPERADMIN_EMAIL) {
      error(res, 400, 'CANNOT_DELETE_SUPERADMIN', 'No se puede eliminar la cuenta del superadmin.');
      return;
    }

    // Soft delete, same convention as products/categories/catalogos: keeps
    // the row (and every order/history referencing it) intact, just blocks
    // login — authMiddleware already rejects requests where isActive=false.
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
