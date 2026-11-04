/**
 * Espejo de packages/shared/src/constants/order-status.ts — web no depende
 * del paquete `shared` (mismo criterio que lib/tiers.ts), así que esta lógica
 * se duplica aquí a propósito. Si cambia el flujo de estados, actualizar ambos.
 */

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  preparado: 'Preparado',
  invoiced: 'Facturado',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

/** Próximos estados válidos desde cada estado (mismo mapa que la API). */
export const ORDER_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparado', 'cancelled'],
  preparado: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  invoiced: ['shipped', 'cancelled'],
  delivered: [],
  cancelled: [],
};

/** Qué estados puede fijar cada rol (solo para mostrar/ocultar botones; la API vuelve a validar). */
export function canRoleSetOrderStatus(role: string | null | undefined, targetStatus: string): boolean {
  if (role === 'admin') return true;
  if (role === 'bodega') return ['preparado', 'shipped', 'delivered', 'cancelled'].includes(targetStatus);
  if (role === 'comercial') return ['confirmed', 'cancelled'].includes(targetStatus);
  return false;
}
