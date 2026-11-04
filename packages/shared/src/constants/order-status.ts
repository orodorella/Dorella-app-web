import type { Role } from '../types/user.js';

/**
 * Flujo de un pedido: Pendiente → Confirmado → Preparado → Enviado → Entregado,
 * con Cancelado alcanzable desde cualquier estado no terminal. "invoiced" es
 * un estado heredado del blueprint original que ya no se asigna desde la UI;
 * se mantiene en el enum de Postgres por compatibilidad con datos antiguos
 * pero no tiene transición de salida propia aquí.
 */
export const ORDER_STATUS_FLOW = ['pending', 'confirmed', 'preparado', 'shipped', 'delivered'] as const;

export type OrderStatusValue = (typeof ORDER_STATUS_FLOW)[number] | 'invoiced' | 'cancelled';

/** Próximos estados válidos desde cada estado. Reenviar el mismo estado (no-op) siempre es válido y se maneja aparte. */
export const ORDER_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparado', 'cancelled'],
  preparado: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  invoiced: ['shipped', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function isValidOrderStatusTransition(from: string, to: string): boolean {
  if (from === to) return true;
  return (ORDER_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * Qué estados puede fijar cada rol, independientemente de si la transición
 * desde el estado actual es válida (eso lo exige isValidOrderStatusTransition).
 * - admin: todos.
 * - bodega: prepara y despacha, pero no aprueba pagos ni confirma pedidos.
 * - comercial: solo confirma (normalmente automático al marcar pagado) y
 *   cancela sus propios pedidos; preparado/enviado/entregado son de bodega.
 */
export function canRoleSetOrderStatus(role: string | null | undefined, targetStatus: string): boolean {
  if (role === 'admin') return true;
  if (role === 'bodega') return ['preparado', 'shipped', 'delivered', 'cancelled'].includes(targetStatus);
  if (role === 'comercial') return ['confirmed', 'cancelled'].includes(targetStatus);
  return false;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  preparado: 'Preparado',
  invoiced: 'Facturado',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

/** Estados que ya se consideran una venta aceptada (con pago aprobado) para reportes de ingresos. */
export const SOLD_ORDER_STATUSES: readonly string[] = ['confirmed', 'preparado', 'invoiced', 'shipped', 'delivered'];

/** Estados en los que un pedido sigue "en curso" después de pagarse, antes de llegar al cliente. */
export const IN_PROGRESS_ORDER_STATUSES: readonly string[] = ['confirmed', 'preparado', 'shipped'];

export type { Role };
