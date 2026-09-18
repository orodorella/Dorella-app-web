import { describe, it, expect } from 'vitest';
import { renderOrderPdf, lineDiscountPct, tierDiscountAmount, type AdminOrder } from '../services/order-pdf.service.js';

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
    { id: 'item-0', sku: 'AR-1', nombreProducto: 'Aretes Gota', cantidad: 2, precioUnitario: 100_000, precioBaseSnapshot: 100_000, descuentoAdicional: 0, subtotal: 200_000 },
    { id: 'item-1', sku: 'CA-1', nombreProducto: 'Cadena Cubana', cantidad: 1, precioUnitario: 200_000, precioBaseSnapshot: 200_000, descuentoAdicional: 0, subtotal: 200_000 },
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

// Pedido por mayor (-37,5%) con 10% extra en los aretes: 400.000 de base,
// 237.500 de total. Es el caso que pidió Dorella y el que salía con precio base.
const pedidoMayorista: AdminOrder = {
  ...fixtureOrder,
  tierAtPurchase: 'por_mayor',
  descuentoAplicado: 0.375,
  subtotal: 400_000,
  total: 237_500,
  items: [
    { ...fixtureOrder.items[0], precioUnitario: 56_250, descuentoAdicional: 10, subtotal: 112_500 },
    { ...fixtureOrder.items[1], precioUnitario: 125_000, descuentoAdicional: 0, subtotal: 125_000 },
  ],
};

describe('descuentos de la factura', () => {
  it('separa el descuento del nivel del descuento adicional', () => {
    expect(tierDiscountAmount(pedidoMayorista)).toBe(150_000);
    // Lo que sobra del descuento total es el 10% extra de la primera línea.
    const adicional = pedidoMayorista.subtotal - pedidoMayorista.total - tierDiscountAmount(pedidoMayorista);
    expect(adicional).toBe(12_500);
  });

  it('muestra únicamente el descuento adicional de cada línea', () => {
    expect(lineDiscountPct(pedidoMayorista.items[0])).toBe(10);
    expect(lineDiscountPct(pedidoMayorista.items[1])).toBe(0);
  });

  it('no depende del precio base para mostrar el descuento de línea', () => {
    expect(lineDiscountPct({ ...pedidoMayorista.items[0], precioBaseSnapshot: 1 })).toBe(10);
  });

  it('genera el PDF del pedido mayorista con descuento adicional', async () => {
    const buffer = await renderOrderPdf(pedidoMayorista);
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(500);
  });
});
