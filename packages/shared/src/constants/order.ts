import type { OrderStatus } from '../types/order.js';

export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'invoiced',
  'shipped',
  'delivered',
  'cancelled',
];

export const PAYMENT_METHODS = ['transferencia', 'efectivo', 'nequi', 'daviplata'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];
