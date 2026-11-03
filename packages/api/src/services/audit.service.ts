import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

type AuditClient = Pick<Prisma.TransactionClient, 'auditLog'>;

/**
 * Registra una operación crítica. Pasar `tx` para que quede en la misma
 * transacción que el cambio. Sin `tx` es "best effort": un fallo de auditoría
 * se loguea pero no tumba la operación de negocio ya confirmada.
 */
export async function recordAudit(entry: AuditEntry, tx?: AuditClient): Promise<void> {
  const data = {
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    before: entry.before,
    after: entry.after,
  };
  if (tx) {
    await tx.auditLog.create({ data });
    return;
  }
  try {
    await prisma.auditLog.create({ data });
  } catch (err) {
    console.error('[AUDIT] No se pudo registrar la auditoría', entry.action, err);
  }
}
