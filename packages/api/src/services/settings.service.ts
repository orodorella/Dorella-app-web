import { prisma } from '../config/db.js';
import { recordAudit } from './audit.service.js';
import { CommissionError } from './commission.service.js';

/**
 * Ajustes administrables (tabla app_settings), sin tocar código ni variables de entorno.
 * Hoy: límite de descuento adicional por línea que puede aplicar un comercial.
 */

const DISCOUNT_KEY = 'comercial_max_descuento_adicional';
/** Valor inicial conservador mientras el administrador no lo configure (el admin puede subirlo hasta 100). */
export const DEFAULT_COMERCIAL_MAX_DISCOUNT = 10;

export function parseDiscountLimit(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new CommissionError('VALIDATION_ERROR', 'El límite de descuento debe estar entre 0 y 100');
  }
  // Hasta 2 decimales, igual que el campo descuentoAdicional de las líneas.
  return Math.round(n * 100) / 100;
}

export async function getCommercialDiscountLimit(): Promise<number> {
  const row = await prisma.appSetting.findUnique({ where: { key: DISCOUNT_KEY } });
  if (!row) return DEFAULT_COMERCIAL_MAX_DISCOUNT;
  try {
    return parseDiscountLimit(row.value);
  } catch {
    // Un valor corrupto nunca debe abrir la puerta a descuentos mayores: se usa el valor conservador.
    return DEFAULT_COMERCIAL_MAX_DISCOUNT;
  }
}

export async function setCommercialDiscountLimit(value: unknown, actorId: string): Promise<number> {
  const limit = parseDiscountLimit(value);
  const before = await getCommercialDiscountLimit();
  await prisma.appSetting.upsert({
    where: { key: DISCOUNT_KEY },
    create: { key: DISCOUNT_KEY, value: limit, updatedBy: actorId },
    update: { value: limit, updatedBy: actorId },
  });
  await recordAudit({
    actorId, action: 'settings.comercial_discount_limit_changed', entityType: 'app_setting', entityId: DISCOUNT_KEY,
    before: { limit: before }, after: { limit },
  });
  return limit;
}
