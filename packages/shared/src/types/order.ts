import type { Tier } from './user.js';

export type OrderStatus = 'pending' | 'confirmed' | 'invoiced' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: string;
  sku: string;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  tierAtPurchase: Tier;
  descuentoAplicado: number;
  subtotal: number;
  total: number;
  notas: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}
