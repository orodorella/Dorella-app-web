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

router.get('/stats', async (_req, res, next) => {
  try {
    const [total, byTierRaw, totalOrders, pendingOrders, revenueRaw] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({ by: ['tier'], _count: true }),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'pending' } }),
      prisma.order.aggregate({ where: { status: { not: 'cancelled' } }, _sum: { total: true } }),
    ]);

    const byTier = { detal: 0, por_mayor: 0, gran_mayor: 0 };
    for (const row of byTierRaw) {
      byTier[row.tier] = row._count;
    }

    success(res, {
      total,
      byTier,
      totalOrders,
      pendingOrders,
      totalRevenue: Number(revenueRaw._sum.total ?? 0),
    });
  } catch (err) {
    next(err);
  }
});

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
        orderBy: { createdAt: 'desc' },
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

export default router;
