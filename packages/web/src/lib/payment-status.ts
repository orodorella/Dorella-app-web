// Widened to accept whatever string the API returns rather than a literal
// union — callers pass raw `paymentStatus` fields straight from JSON
// responses, and an unrecognized value should degrade to "Falta pagar"
// rather than fail to compile.
export type PaymentStatusValue = string | null | undefined;

export const FINAL_PAYMENT_STATUSES = new Set(['approved', 'rejected', 'cancelled', 'refunded', 'charged_back']);

export function isFinalPaymentStatus(status: PaymentStatusValue): boolean {
  return typeof status === 'string' && FINAL_PAYMENT_STATUSES.has(status);
}

export function isPaymentApproved(status: PaymentStatusValue): boolean {
  return status === 'approved';
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Falta pagar',
  in_process: 'En revisión',
  approved: 'Pago aprobado',
  rejected: 'Pago rechazado',
  cancelled: 'Pago cancelado',
  refunded: 'Pago reembolsado',
  charged_back: 'Contracargo',
};

export function paymentStatusLabel(status: PaymentStatusValue): string {
  return PAYMENT_STATUS_LABELS[status ?? 'pending'] ?? 'Falta pagar';
}

export type PaymentStatusTone = 'pending' | 'approved' | 'rejected' | 'neutral';

export function paymentStatusTone(status: PaymentStatusValue): PaymentStatusTone {
  if (status === 'approved') return 'approved';
  if (status === 'rejected' || status === 'cancelled' || status === 'charged_back') return 'rejected';
  if (status === 'refunded') return 'neutral';
  return 'pending';
}

// Semantic fills, no heavy outline — subtle background + text only, matching
// the rest of the admin UI's badge convention (amber = warning, emerald =
// success, red = error, stone = neutral).
export const PAYMENT_STATUS_BADGE_CLASSES: Record<PaymentStatusTone, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  neutral: 'bg-stone-100 text-stone-500',
};

// Only the two customer-facing pedido states this flow manages. Other
// OrderStatus values (invoiced/shipped/delivered) can still exist from the
// admin's separate post-confirmation tracking, but aren't part of this bar.
export function orderConfirmedLabel(orderStatus: string): string {
  return orderStatus === 'confirmed' ? 'Pedido confirmado' : 'Pendiente de confirmación';
}
