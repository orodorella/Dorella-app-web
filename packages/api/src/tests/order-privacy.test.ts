import { describe, expect, it } from 'vitest';
import { formatOrder } from '../services/order.service.js';

const dbOrder = {
  id: 'order-1',
  orderNumber: 'DOR-1',
  status: 'pending',
  tierAtPurchase: 'por_mayor',
  descuentoAplicado: 0.375,
  subtotal: 100_000,
  total: 56_250,
  notas: null,
  compradorNombre: 'Cliente',
  compradorApellido: 'Prueba',
  compradorTelefono: undefined,
  compradorEmail: undefined,
  direccionEnvio: null,
  origen: 'whatsapp',
  createdByAdminId: 'admin-1',
  paymentStatus: 'pending',
  paymentProvider: null,
  paidAt: null,
  createdAt: new Date('2026-09-18T00:00:00Z'),
  updatedAt: new Date('2026-09-18T00:00:00Z'),
  items: [{
    id: 'item-1',
    sku: 'REF-1',
    nombreProducto: 'Producto',
    cantidad: 1,
    precioUnitario: 56_250,
    precioBaseSnapshot: 100_000,
    descuentoAdicional: 10,
    subtotal: 56_250,
  }],
};

describe('privacidad de precios en órdenes', () => {
  it('no expone precioBaseSnapshot en respuestas normales', () => {
    const response = formatOrder(dbOrder);
    expect(JSON.stringify(response)).not.toContain('precioBase');
    expect(response.items[0]).not.toHaveProperty('precioBaseSnapshot');
  });

  it('sólo habilita el snapshot para el render interno del PDF', () => {
    const internal = formatOrder(dbOrder, true);
    expect(internal.items[0]).toHaveProperty('precioBaseSnapshot', 100_000);
  });
});
