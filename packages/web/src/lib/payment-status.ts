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

export const PAYMENT_STATUS_BADGE_CLASSES: Record<PaymentStatusTone, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  neutral: 'bg-stone-100 text-stone-500 border-stone-200',
};

// Only the two customer-facing pedido states this flow manages. Other
// OrderStatus values (invoiced/shipped/delivered) can still exist from the
// admin's separate post-confirmation tracking, but aren't part of this bar.
export function orderConfirmedLabel(orderStatus: string): string {
  return orderStatus === 'confirmed' ? 'Pedido confirmado' : 'Pendiente de confirmación';
}
