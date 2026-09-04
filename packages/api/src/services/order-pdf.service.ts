import { Buffer } from 'node:buffer';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { getAdminOrderById } from './order.service.js';

export type AdminOrder = NonNullable<Awaited<ReturnType<typeof getAdminOrderById>>>;

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#292524' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  brand: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#5B0E16' },
  muted: { color: '#78716c' },
  sectionTitle: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: '#a8a29e', marginBottom: 4 },
  twoCol: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 20 },
  col: { flex: 1 },
  table: { marginTop: 8, borderTop: '1px solid #e7e5e4' },
  tableRow: { flexDirection: 'row', borderBottom: '1px solid #f5f5f4', paddingVertical: 6 },
  tableHeader: { flexDirection: 'row', borderBottom: '1px solid #e7e5e4', paddingVertical: 6, backgroundColor: '#fafaf9' },
  colSku: { width: '18%' },
  colNombre: { width: '40%' },
  colCantidad: { width: '14%', textAlign: 'right' },
  colPrecio: { width: '14%', textAlign: 'right' },
  colSubtotal: { width: '14%', textAlign: 'right' },
  th: { fontSize: 8, textTransform: 'uppercase', color: '#a8a29e', letterSpacing: 0.5 },
  totals: { marginTop: 16, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', width: 200, marginBottom: 4 },
  totalLabel: { color: '#78716c' },
  grandTotal: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#5B0E16' },
  footer: { marginTop: 32, fontSize: 8, color: '#a8a29e', textAlign: 'center' },
  badge: { fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.5, color: '#78716c' },
});

interface Direccion {
  direccion?: string;
  ciudad?: string;
  departamento?: string;
  pais?: string;
  region?: string;
  telefonoCompleto?: string;
  referencias?: string;
  informacionAdicional?: string;
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  approved: 'Pagado',
  pending: 'Pendiente de pago',
  rejected: 'Rechazado',
};

function OrderPdfDocument({ order }: { order: AdminOrder }) {
  const direccion = (order.direccionEnvio ?? {}) as Direccion;
  const fecha = new Date(order.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(
        View,
        { style: styles.headerRow },
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.brand }, 'Dorella'),
          React.createElement(Text, { style: styles.muted }, 'Joyería en oro laminado 18k'),
        ),
        React.createElement(
          View,
          { style: { alignItems: 'flex-end' } },
          React.createElement(Text, { style: { fontFamily: 'Helvetica-Bold', fontSize: 13 } }, `Comprobante de pedido`),
          React.createElement(Text, { style: styles.muted }, order.orderNumber),
          React.createElement(Text, { style: styles.muted }, fecha),
        ),
      ),
      React.createElement(
        View,
        { style: styles.twoCol },
        React.createElement(
          View,
          { style: styles.col },
          React.createElement(Text, { style: styles.sectionTitle }, 'Cliente'),
          React.createElement(Text, null, `${order.comprador?.nombre ?? ''} ${order.comprador?.apellido ?? ''}`.trim() || '—'),
          order.comprador?.telefono ? React.createElement(Text, { style: styles.muted }, order.comprador.telefono) : null,
          order.comprador?.correo ? React.createElement(Text, { style: styles.muted }, order.comprador.correo) : null,
        ),
        React.createElement(
          View,
          { style: styles.col },
          React.createElement(Text, { style: styles.sectionTitle }, 'Entrega'),
          direccion.direccion ? React.createElement(Text, null, direccion.direccion) : null,
          React.createElement(Text, { style: styles.muted }, [direccion.ciudad, direccion.departamento || direccion.region, direccion.pais].filter(Boolean).join(', ') || '—'),
          (direccion.referencias || direccion.informacionAdicional) ? React.createElement(Text, { style: styles.muted }, direccion.referencias || direccion.informacionAdicional) : null,
        ),
        React.createElement(
          View,
          { style: styles.col },
          React.createElement(Text, { style: styles.sectionTitle }, 'Pago'),
          React.createElement(Text, null, PAYMENT_STATUS_LABELS[order.paymentStatus ?? ''] ?? 'Sin registrar'),
          React.createElement(Text, { style: styles.badge }, order.metodoPago === 'online' ? 'Mercado Pago' : 'WhatsApp / manual'),
        ),
      ),
      React.createElement(
        View,
        { style: styles.table },
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: [styles.colSku, styles.th] }, 'SKU'),
          React.createElement(Text, { style: [styles.colNombre, styles.th] }, 'Producto'),
          React.createElement(Text, { style: [styles.colCantidad, styles.th] }, 'Cant.'),
          React.createElement(Text, { style: [styles.colPrecio, styles.th] }, 'Precio'),
          React.createElement(Text, { style: [styles.colSubtotal, styles.th] }, 'Subtotal'),
        ),
        ...order.items.map((item) =>
          React.createElement(
            View,
            { key: item.id, style: styles.tableRow },
            React.createElement(Text, { style: styles.colSku }, item.sku),
            React.createElement(Text, { style: styles.colNombre }, item.nombreProducto),
            React.createElement(Text, { style: styles.colCantidad }, String(item.cantidad)),
            React.createElement(Text, { style: styles.colPrecio }, COP.format(item.precioUnitario)),
            React.createElement(Text, { style: styles.colSubtotal }, COP.format(item.subtotal)),
          ),
        ),
      ),
      React.createElement(
        View,
        { style: styles.totals },
        React.createElement(
          View,
          { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, 'Subtotal'),
          React.createElement(Text, null, COP.format(order.subtotal)),
        ),
        order.descuentoAplicado > 0
          ? React.createElement(
              View,
              { style: styles.totalRow },
              React.createElement(Text, { style: styles.totalLabel }, `Descuento (${(order.descuentoAplicado * 100).toFixed(1)}%)`),
              React.createElement(Text, null, `- ${COP.format(order.subtotal - order.total)}`),
            )
          : null,
        React.createElement(
          View,
          { style: [styles.totalRow, { marginTop: 4 }] },
          React.createElement(Text, { style: styles.grandTotal }, 'Total'),
          React.createElement(Text, { style: styles.grandTotal }, COP.format(order.total)),
        ),
      ),
      order.notas
        ? React.createElement(
            View,
            { style: { marginTop: 24 } },
            React.createElement(Text, { style: styles.sectionTitle }, 'Notas'),
            React.createElement(Text, { style: styles.muted }, order.notas),
          )
        : null,
      React.createElement(
        Text,
        { style: styles.footer },
        'Este comprobante es un resumen interno del pedido, no constituye una factura electrónica.',
      ),
    ),
  );
}

export async function renderOrderPdf(order: AdminOrder): Promise<Buffer> {
  return renderToBuffer(React.createElement(OrderPdfDocument, { order }) as Parameters<typeof renderToBuffer>[0]);
}
