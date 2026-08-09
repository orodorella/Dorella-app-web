'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { useToast } from '@/context/ToastProvider';
import {
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Filter,
  CheckCircle2,
  Plus,
  MessageCircle,
  CreditCard,
  Banknote,
} from 'lucide-react';
import {
  PAYMENT_STATUS_BADGE_CLASSES,
  isPaymentApproved,
  paymentStatusLabel,
  paymentStatusTone,
} from '@/lib/payment-status';
import { PaymentStageBar } from '@/components/pedidos/PaymentStageBar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

// Tier es una categoría del cliente, no un estado — un único badge neutro
// para los tres tiers, sin distinción de color.
const TIER_LABELS: Record<string, string> = { detal: 'Detal', por_mayor: 'Por Mayor', gran_mayor: 'Gran Mayor' };
const TIER_BADGE_CLASS = 'whitespace-nowrap bg-stone-100 text-stone-600';

// Sistema semántico de 3 colores para el estado del pedido: ámbar = pendiente,
// verde = confirmado o más avanzado, rojo = cancelado. Sin bordes gruesos.
const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-emerald-50 text-emerald-700',
  invoiced: 'bg-emerald-50 text-emerald-700',
  shipped: 'bg-emerald-50 text-emerald-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700',
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente de confirmación',
  confirmed: 'Pedido confirmado',
  invoiced: 'Facturado',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};
const ALL_STATUSES = ['pending', 'confirmed', 'invoiced', 'shipped', 'delivered', 'cancelled'];
const STATUS_FLOW: Record<string, string> = { confirmed: 'shipped', shipped: 'delivered' };

type PaymentMethod = 'online' | 'whatsapp';
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { online: 'En línea', whatsapp: 'WhatsApp' };

interface OrderItem {
  id: string;
  sku: string;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

interface ShippingAddress {
  pais?: string;
  paisCodigo?: string;
  region?: string;
  regionCodigo?: string | null;
  departamento?: string;
  ciudad?: string;
  direccion?: string;
  referencias?: string;
  informacionAdicional?: string;
  telefonoIndicativo?: string;
  telefonoNumero?: string;
  telefonoCompleto?: string;
}

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string | null;
  metodoPago: PaymentMethod;
  paymentMarkedPaidByAdmin?: string | null;
  paidAt?: string | null;
  tierAtPurchase: string;
  total: number;
  createdAt: string;
  origen: string;
  notas?: string | null;
  comprador?: { nombre: string; apellido: string; telefono: string; correo: string | null } | null;
  direccionEnvio?: ShippingAddress | null;
  user?: { nombre: string; apellido: string; email: string; tier: string } | null;
  items: OrderItem[];
}

interface Meta {
  page: number;
  pageSize: number;
  total: number;
}

function renderShippingSummary(direccionEnvio?: ShippingAddress | null) {
  if (!direccionEnvio) return null;

  const lines = [
    direccionEnvio.telefonoCompleto ? `Teléfono: ${direccionEnvio.telefonoCompleto}` : null,
    direccionEnvio.pais ? `País: ${direccionEnvio.pais}` : null,
    direccionEnvio.region || direccionEnvio.departamento
      ? `Región / Estado / Departamento: ${direccionEnvio.region || direccionEnvio.departamento}`
      : null,
    direccionEnvio.ciudad ? `Ciudad / Municipio: ${direccionEnvio.ciudad}` : null,
    direccionEnvio.direccion ? `Dirección: ${direccionEnvio.direccion}` : null,
    direccionEnvio.referencias || direccionEnvio.informacionAdicional
      ? `Referencias: ${direccionEnvio.referencias || direccionEnvio.informacionAdicional}`
      : null,
  ].filter(Boolean);

  if (lines.length === 0) return null;

  return (
    <div className="mt-3 space-y-1 text-xs text-stone-500">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

function PaymentMethodIndicator({ metodoPago }: { metodoPago: PaymentMethod }) {
  const Icon = metodoPago === 'whatsapp' ? MessageCircle : CreditCard;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-stone-100 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-stone-600">
      <Icon size={11} className={metodoPago === 'whatsapp' ? 'text-emerald-600' : 'text-wine'} />
      {PAYMENT_METHOD_LABELS[metodoPago]}
    </span>
  );
}

export default function AdminOrdenesPage() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmMarkPaid, setConfirmMarkPaid] = useState<{ id: string; orderNumber: string } | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);

  const loadOrders = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('pageSize', '10');
    if (statusFilter) qs.set('status', statusFilter);

    request('GET', `/api/admin/orders?${qs.toString()}`)
      .then((res) => {
        if (res.success) {
          setOrders(res.data);
          setMeta(res.meta);
        }
      })
      .catch((error: Error) => showToast(error.message, 'error'))
      .finally(() => setLoading(false));
  }, [page, statusFilter, showToast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get('open');
    if (orderId) openDetail(orderId);
  }, []);

  function openDetail(orderId: string) {
    setDetailLoading(true);
    request('GET', `/api/admin/orders/${orderId}`)
      .then((res) => {
        if (res.success) setSelectedOrder(res.data);
      })
      .catch((error: Error) => showToast(error.message, 'error'))
      .finally(() => setDetailLoading(false));
  }

  async function changeStatus(orderId: string, status: string) {
    try {
      await request('PATCH', `/api/admin/orders/${orderId}/status`, { status });
      showToast(`Estado cambiado a ${STATUS_LABELS[status]}`);
      loadOrders();
      if (selectedOrder?.id === orderId) openDetail(orderId);
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  }

  async function confirmOrder(orderId: string) {
    try {
      await request('POST', `/api/admin/orders/${orderId}/confirm`);
      showToast('Pedido confirmado');
      loadOrders();
      if (selectedOrder?.id === orderId) openDetail(orderId);
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  }

  function requestMarkPaid(order: { id: string; orderNumber: string }) {
    setConfirmMarkPaid({ id: order.id, orderNumber: order.orderNumber });
  }

  async function confirmMarkPaidAction() {
    if (!confirmMarkPaid) return;
    const orderId = confirmMarkPaid.id;
    setMarkingPaid(true);

    try {
      await request('POST', `/api/admin/orders/${orderId}/mark-paid`);
      showToast('Pedido marcado como pagado');
      loadOrders();
      if (selectedOrder?.id === orderId) openDetail(orderId);
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setMarkingPaid(false);
      setConfirmMarkPaid(null);
    }
  }

  const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 1;

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="mb-1 text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
            Órdenes
          </h1>
          <p className="text-sm text-stone-400">Gestión de pedidos</p>
        </div>
        <Link
          href="/admin/ordenes/nueva"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-wine px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white hover:bg-wine-light"
        >
          <Plus size={15} /> Crear pedido
        </Link>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <Filter size={14} className="text-stone-400" />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
          className="cursor-pointer rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-600 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          {ALL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 size={28} className="mx-auto animate-spin text-wine" />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-stone-400">
            <ShoppingBag size={40} className="mx-auto mb-3 text-stone-200" />
            <p>No hay órdenes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-[10px] uppercase tracking-wider text-stone-400">
                  <th className="px-6 py-3 text-left font-medium">Orden</th>
                  <th className="px-6 py-3 text-left font-medium">Usuario</th>
                  <th className="px-6 py-3 text-left font-medium">Tier</th>
                  <th className="px-6 py-3 text-center font-medium">Items</th>
                  <th className="px-6 py-3 text-right font-medium">Total</th>
                  <th className="px-6 py-3 text-left font-medium">Método</th>
                  <th className="px-6 py-3 text-left font-medium">Pago</th>
                  <th className="px-6 py-3 text-left font-medium">Pedido</th>
                  <th className="px-6 py-3 text-left font-medium">Fecha</th>
                  <th className="px-6 py-3 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => (
                  <tr
                    key={order.id}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-ivory/50'} transition-colors hover:bg-stone-50`}
                  >
                    <td className="px-6 py-3.5 font-medium text-stone-700">{order.orderNumber}</td>
                    <td className="px-6 py-3.5 text-stone-600">
                      {order.comprador?.nombre ?? order.user?.nombre} {order.comprador?.apellido ?? order.user?.apellido}
                      {!order.user && <span className="block text-[10px] text-stone-400">Invitado</span>}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${TIER_BADGE_CLASS}`}>
                        {TIER_LABELS[order.tierAtPurchase] || order.tierAtPurchase}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center text-stone-500">{order.items?.reduce((sum, item) => sum + item.cantidad, 0) || 0}</td>
                    <td className="px-6 py-3.5 text-right font-medium text-stone-700" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCOP(order.total)}
                    </td>
                    <td className="px-6 py-3.5">
                      <PaymentMethodIndicator metodoPago={order.metodoPago} />
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider ${PAYMENT_STATUS_BADGE_CLASSES[paymentStatusTone(order.paymentStatus)]}`}>
                        {paymentStatusLabel(order.paymentStatus)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider ${STATUS_STYLES[order.status] || ''}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-stone-400">{new Date(order.createdAt).toLocaleDateString('es-CO')}</td>
                    <td className="px-6 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {order.metodoPago === 'whatsapp' && !isPaymentApproved(order.paymentStatus) && (
                          <button
                            onClick={() => requestMarkPaid(order)}
                            className="flex cursor-pointer items-center gap-1 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-800"
                          >
                            <Banknote size={13} /> Marcar pagado
                          </button>
                        )}
                        {order.status === 'pending' && isPaymentApproved(order.paymentStatus) && (
                          <button
                            onClick={() => confirmOrder(order.id)}
                            className="flex cursor-pointer items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-800"
                          >
                            <CheckCircle2 size={13} /> Confirmar
                          </button>
                        )}
                        <button
                          onClick={() => openDetail(order.id)}
                          className="cursor-pointer rounded border border-stone-200 px-3 py-1.5 text-xs text-wine transition-colors hover:border-wine/20 hover:text-wine-light"
                        >
                          Detalle
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-stone-100 px-6 py-4">
            <p className="text-xs text-stone-400">{meta.total} órdenes</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="cursor-pointer rounded border border-stone-200 p-2 hover:bg-stone-50 disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 text-xs text-stone-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="cursor-pointer rounded border border-stone-200 p-2 hover:bg-stone-50 disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {(selectedOrder || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedOrder(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute right-4 top-4 cursor-pointer text-stone-400 hover:text-stone-600"
            >
              <X size={18} />
            </button>

            {detailLoading ? (
              <div className="py-20 text-center">
                <Loader2 size={28} className="mx-auto animate-spin text-wine" />
              </div>
            ) : selectedOrder ? (
              <div className="p-6">
                <h3 className="mb-1 text-xl font-semibold text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                  {selectedOrder.orderNumber}
                </h3>
                <p className="mb-6 text-sm text-stone-400">{new Date(selectedOrder.createdAt).toLocaleDateString('es-CO')}</p>

                {selectedOrder.user ? (
                  <div className="mb-4 rounded-lg bg-ivory p-4 text-sm">
                    <p className="font-medium text-stone-700">{selectedOrder.user.nombre} {selectedOrder.user.apellido}</p>
                    <p className="text-stone-500">{selectedOrder.user.email}</p>
                    {selectedOrder.comprador?.telefono && <p className="text-stone-500">{selectedOrder.comprador.telefono}</p>}
                    <span className={`mt-1 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${TIER_BADGE_CLASS}`}>
                      {TIER_LABELS[selectedOrder.user.tier] || selectedOrder.user.tier}
                    </span>
                    {renderShippingSummary(selectedOrder.direccionEnvio)}
                  </div>
                ) : selectedOrder.comprador ? (
                  <div className="mb-4 rounded-lg bg-ivory p-4 text-sm">
                    <div className="mb-2 flex items-center gap-2">
                      <MessageCircle size={14} className="text-emerald-600" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Pedido manual · WhatsApp</span>
                    </div>
                    <p className="font-medium text-stone-700">{selectedOrder.comprador.nombre} {selectedOrder.comprador.apellido}</p>
                    <p className="text-stone-500">{selectedOrder.comprador.telefono}</p>
                    {selectedOrder.comprador.correo && <p className="text-stone-500">{selectedOrder.comprador.correo}</p>}
                    {renderShippingSummary(selectedOrder.direccionEnvio)}
                  </div>
                ) : null}

                <div className="mb-4 space-y-2">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="flex justify-between border-b border-stone-100 py-2 text-sm">
                      <div>
                        <span className="text-stone-700">{item.nombreProducto}</span>
                        <span className="ml-2 text-xs text-stone-400">{item.sku} × {item.cantidad}</span>
                      </div>
                      <span className="font-medium text-stone-700" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCOP(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mb-4 flex items-baseline justify-between border-t border-stone-200 pt-2">
                  <span className="font-semibold text-stone-600">Total</span>
                  <span className="text-xl font-bold text-wine">{formatCOP(selectedOrder.total)}</span>
                </div>

                {selectedOrder.notas && (
                  <div className="mb-4 rounded-lg border border-stone-100 p-3">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Nota administrativa</p>
                    <p className="text-sm text-stone-600">{selectedOrder.notas}</p>
                  </div>
                )}

                <div className="mb-6 rounded-lg bg-ivory p-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Estado del pago y del pedido</p>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <PaymentMethodIndicator metodoPago={selectedOrder.metodoPago} />
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider ${PAYMENT_STATUS_BADGE_CLASSES[paymentStatusTone(selectedOrder.paymentStatus)]}`}>
                      {paymentStatusLabel(selectedOrder.paymentStatus)}
                    </span>
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider ${STATUS_STYLES[selectedOrder.status] || ''}`}>
                      {STATUS_LABELS[selectedOrder.status] || selectedOrder.status}
                    </span>
                  </div>
                  <PaymentStageBar
                    paymentApproved={isPaymentApproved(selectedOrder.paymentStatus)}
                    orderConfirmed={selectedOrder.status === 'confirmed'}
                  />
                  {selectedOrder.paymentMarkedPaidByAdmin && (
                    <p className="mt-3 text-[11px] text-stone-500">
                      Marcado como pagado por <span className="font-medium text-stone-600">{selectedOrder.paymentMarkedPaidByAdmin}</span>
                      {selectedOrder.paidAt && ` · ${new Date(selectedOrder.paidAt).toLocaleString('es-CO')}`}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Acciones</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrder.status === 'pending' && (
                      isPaymentApproved(selectedOrder.paymentStatus) ? (
                        <button
                          onClick={() => confirmOrder(selectedOrder.id)}
                          className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                        >
                          <CheckCircle2 size={14} /> Confirmar pedido
                        </button>
                      ) : selectedOrder.metodoPago === 'whatsapp' ? (
                        <button
                          onClick={() => requestMarkPaid(selectedOrder)}
                          className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
                        >
                          <Banknote size={14} /> Marcar como pagado
                        </button>
                      ) : (
                        <span className="rounded-lg bg-stone-100 px-4 py-2 text-xs font-medium text-stone-400">
                          Esperando pago aprobado para poder confirmar
                        </span>
                      )
                    )}

                    {STATUS_FLOW[selectedOrder.status] && (
                      <button
                        onClick={() => changeStatus(selectedOrder.id, STATUS_FLOW[selectedOrder.status])}
                        className="cursor-pointer rounded-lg bg-wine px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-wine-light"
                      >
                        → {STATUS_LABELS[STATUS_FLOW[selectedOrder.status]]}
                      </button>
                    )}

                    {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && (
                      <button
                        onClick={() => changeStatus(selectedOrder.id, 'cancelled')}
                        className="cursor-pointer rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmMarkPaid}
        title="Marcar pedido como pagado"
        message={
          confirmMarkPaid
            ? `Vas a confirmar manualmente que el pedido ${confirmMarkPaid.orderNumber} fue pagado por WhatsApp. Esta acción queda registrada a tu nombre y no se puede deshacer desde aquí.`
            : ''
        }
        confirmLabel={markingPaid ? 'Marcando...' : 'Marcar como pagado'}
        onConfirm={confirmMarkPaidAction}
        onCancel={() => setConfirmMarkPaid(null)}
      />
    </div>
  );
}
