import type { Tier } from 'shared/src/types/user.js';
import { prisma } from '../config/db.js';

export class CustomerTierError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/**
 * Cambia el tier de un cliente y deja constancia en tier_change_log.
 * Lo usan el admin (/admin/users/:id/tier) y el comercial (desde el pedido manual).
 * Por defecto solo cambia cuentas con rol cliente (el comercial no puede tocar a otro
 * personal del panel); solo la ruta de admin pasa `allowStaffTargets: true`.
 */
export async function changeCustomerTier(
  userId: string,
  newTier: Tier,
  actorId: string,
  opts: { allowStaffTargets?: boolean; reason?: string } = {},
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, tier: true, isActive: true, role: true },
  });
  // Falla cerrado: por defecto solo se pueden cambiar cuentas con rol cliente.
  if (!user || (!opts.allowStaffTargets && user.role !== 'cliente')) {
    throw new CustomerTierError(404, 'NOT_FOUND', 'Usuario no encontrado');
  }
  if (!user.isActive) throw new CustomerTierError(400, 'USER_INACTIVE', 'No se puede cambiar un usuario inactivo.');
  if (user.tier === newTier) throw new CustomerTierError(400, 'SAME_TIER', 'El usuario ya tiene este tier');

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { tier: newTier, tierChangedAt: new Date(), tierChangedBy: actorId },
      select: { id: true, email: true, nombre: true, tier: true },
    }),
    prisma.tierChangeLog.create({
      data: { userId, oldTier: user.tier, newTier, reason: opts.reason ?? 'admin_manual', changedBy: actorId },
    }),
  ]);
  return updated;
}
