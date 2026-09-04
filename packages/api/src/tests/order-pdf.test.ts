import { describe, it, expect } from 'vitest';
import { renderOrderPdf, type AdminOrder } from '../services/order-pdf.service.js';

const fixtureOrder: AdminOrder = {
  id: 'order-1',
  orderNumber: 'DOR-20260808-0001',
  status: 'confirmed',
  tierAtPurchase: 'detal',
  descuentoAplicado: 0,
  subtotal: 400_000,
  total: 400_000,
  notas: 'Entregar en portería',
  comprador: { nombre: 'Karen', apellido: 'López', telefono: '+57 300 123 4567', correo: 'karen@example.com' },
  direccionEnvio: { direccion: 'Calle 10 # 20-30', ciudad: 'Medellín', informacionAdicional: 'Apto 201' },
  origen: 'whatsapp',
  createdByAdminId: 'admin-1',
  paymentStatus: 'approved',
  paymentProvider: null,
  metodoPago: 'whatsapp',
  paidAt: new Date('2026-08-08').toISOString(),
  paymentMarkedPaidByAdmin: 'Admin Uno',
  reservationStatus: 'consumed',
  reservationExpiresAt: null,
  retryable: false,
  items: [
    { id: 'item-0', sku: 'AR-1', nombreProducto: 'Aretes Gota', cantidad: 2, precioUnitario: 100_000, subtotal: 200_000 },
    { id: 'item-1', sku: 'CA-1', nombreProducto: 'Cadena Cubana', cantidad: 1, precioUnitario: 200_000, subtotal: 200_000 },
  ],
  createdAt: new Date('2026-08-08').toISOString(),
  updatedAt: new Date('2026-08-08').toISOString(),
  user: null,
};

describe('renderOrderPdf', () => {
  it('genera un PDF válido con los datos del pedido', async () => {
    const buffer = await renderOrderPdf(fixtureOrder);
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('no falla cuando no hay notas ni descuento', async () => {
    const buffer = await renderOrderPdf({ ...fixtureOrder, notas: null, descuentoAplicado: 0 });
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
  });
});
