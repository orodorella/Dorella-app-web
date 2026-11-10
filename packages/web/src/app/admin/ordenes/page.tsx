'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { useToast } from '@/context/ToastProvider';
import { useAuth } from '@/context/AuthProvider';
import { canCreateOrders, canMarkOrdersPaid, canUpdateOrderStatus } from '@/lib/admin-access';
import { canRoleSetOrderStatus } from '@/lib/order-status';
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
  FileDown,
} from 'lucide-react';
import {
  PAYMENT_STATUS_BADGE_CLASSES,
  isPaymentApproved,
  paymentStatusLabel,
  paymentStatusTone,
} from '@/lib/payment-status';
import { PaymentStageBar } from '@/components/pedidos/PaymentStageBar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Dialog from '@/components/admin/Dialog';
import { formatDate, formatDateTime } from '@/lib/format';

const TIER_LABELS: Record<string, string> = {
  detal: 'Detal',
  por_mayor: 'Por Mayor',
  gran_mayor: 'Gran Mayor',
};

const TIER_BADGE_CLASS = 'whitespace-nowrap bg-stone-100 text-stone-600';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-emerald-50 text-emerald-700',
  preparado: 'bg-blue-50 text-blue-700',
  invoiced: 'bg-emerald-50 text-emerald-700',
  shipped: 'bg-emerald-50 text-emerald-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente de confirmación',
  confirmed: 'Pedido confirmado',
  preparado: 'Preparado',
  invoiced: 'Facturado',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const ALL_STATUSES = ['pending', 'confirmed', 'preparado', 'invoiced', 'shipped', 'delivered', 'cancelled'];
// Siguiente paso "de un clic" del flujo normal (sin contar Confirmar/Cancelar,
// que tienen su propio botón con su propia validación): Confirmado → Preparado
// → Enviado → Entregado.
const STATUS_FLOW: Record<string, string> = { confirmed: 'preparado', preparado: 'shipped', shipped: 'delivered' };

type PaymentMethod = 'online' | 'whatsapp';

// Pedido "en línea" que el cliente terminó pagando por otra vía: el método real queda registrado.
const ONLINE_PAY_METHODS = [
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' },
  { value: 'transferencia', label: 'Transferencia bancaria' },
  { value: 'efectivo', label: 'Efectivo' },
] as const;

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  online: 'En línea',
  whatsapp: 'WhatsApp',
};

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
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700">
      <Icon size={11} className={metodoPago === 'whatsapp' ? 'text-emerald-600' : 'text-wine'} />
      {PAYMENT_METHOD_LABELS[metodoPago]}
    </span>
  );
}

function OrderActionButtons({
  order,
  onRequestMarkPaid,
  onConfirmOrder,
  onOpenDetail,
  canMarkPaid,
  canConfirm,
  inline = false,
}: {
  canMarkPaid: boolean;
  /** Puede confirmar pedidos (admin/comercial sobre los suyos) — bodega no. */
  canConfirm: boolean;
  order: OrderRow;
  onRequestMarkPaid: (order: { id: string; orderNumber: string; metodoPago: PaymentMethod }) => void;
  onConfirmOrder: (orderId: string) => void;
  onOpenDetail: (orderId: string) => void;
  /** En la tabla las acciones van en una sola línea alineadas a la derecha. */
  inline?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${inline ? 'justify-end whitespace-nowrap' : 'flex-wrap'}`}>
      {canMarkPaid && (order.metodoPago === 'whatsapp' || order.status === 'pending') && !isPaymentApproved(order.paymentStatus) ? (
        <button
          onClick={() => onRequestMarkPaid(order)}
          className="flex cursor-pointer items-center gap-1 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-800"
        >
          <Banknote size={13} />
          Marcar pagado
        </button>
      ) : null}

      {canConfirm && order.status === 'pending' && isPaymentApproved(order.paymentStatus) ? (
        <button
          onClick={() => onConfirmOrder(order.id)}
          className="flex cursor-pointer items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-800"
        >
          <CheckCircle2 size={13} />
          Confirmar
        </button>
      ) : null}

      <button
        onClick={() => onOpenDetail(order.id)}
        className="cursor-pointer rounded-lg border border-wine/40 bg-white px-3 py-1.5 text-xs font-semibold text-wine transition-colors hover:border-wine hover:bg-wine-50"
      >
        Detalle
      </button>
    </div>
  );
}

export default function AdminOrdenesPage() {
  const { showToast } = useToast();
  const { user: authUser } = useAuth();
  const role = authUser?.role;
  const canMarkPaid = canMarkOrdersPaid(role);
  const canUpdateStatus = canUpdateOrderStatus(role);
  const canConfirm = canRoleSetOrderStatus(role, 'confirmed');
  const canCreate = canCreateOrders(role);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [page, setPage] = useState(1);
  // Permite enlaces como /admin/ordenes?status=confirmed desde el tablero operativo.
  const [statusFilter, setStatusFilter] = useState(() => (
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('status') ?? '' : ''
  ));
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmMarkPaid, setConfirmMarkPaid] = useState<{ id: string; orderNumber: string; metodoPago: PaymentMethod } | null>(null);
  const [onlinePayMethod, setOnlinePayMethod] = useState<(typeof ONLINE_PAY_METHODS)[number]['value']>('nequi');
  const [shipDialog, setShipDialog] = useState<{ id: string; guia: string } | null>(null);
  const [shipping, setShipping] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

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

  async function changeStatus(orderId: string, status: string, guia?: string) {
    try {
      const res = await request('PATCH', `/api/admin/orders/${orderId}/status`, guia ? { status, guia } : { status });
      if (!res.success) throw new Error(res.error?.message || 'No se pudo cambiar el estado del pedido.');
      showToast(`Estado cambiado a ${STATUS_LABELS[status]}`);
      loadOrders();
      if (selectedOrder?.id === orderId) openDetail(orderId);
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  }

  async function downloadInvoice(orderId: string, orderNumber: string) {
    setDownloadingInvoice(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/pdf`, { credentials: 'include' });
      if (!res.ok) throw new Error('Error generando el comprobante');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pedido-${orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setDownloadingInvoice(false);
    }
  }

  async function confirmOrder(orderId: string) {
    try {
      const res = await request('POST', `/api/admin/orders/${orderId}/confirm`);
      if (!res.success) throw new Error(res.error?.message || 'No se pudo confirmar el pedido.');
      showToast('Pedido confirmado');
      loadOrders();
      if (selectedOrder?.id === orderId) openDetail(orderId);
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  }

  function requestMarkPaid(order: { id: string; orderNumber: string; metodoPago: PaymentMethod }) {
    setOnlinePayMethod('nequi');
    setConfirmMarkPaid({ id: order.id, orderNumber: order.orderNumber, metodoPago: order.metodoPago });
  }

  function requestShip(orderId: string) {
    setShipDialog({ id: orderId, guia: '' });
  }

  async function confirmShipAction() {
    if (!shipDialog) return;
    setShipping(true);
    try {
      await changeStatus(shipDialog.id, 'shipped', shipDialog.guia.trim() || undefined);
      setShipDialog(null);
    } finally {
      setShipping(false);
    }
  }

  async function confirmMarkPaidAction() {
    if (!confirmMarkPaid) return;
    const orderId = confirmMarkPaid.id;
    setMarkingPaid(true);

    try {
      const res = confirmMarkPaid.metodoPago === 'online'
        ? await request('POST', `/api/admin/orders/${orderId}/mark-paid`, { metodo: onlinePayMethod })
        : await request('POST', `/api/admin/orders/${orderId}/mark-paid`);
      if (!res.success) throw new Error(res.error?.message || 'No se pudo marcar el pedido como pagado.');
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
    <div className="min-w-0">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="mb-1 text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
            Órdenes
          </h1>
          <p className="text-sm text-stone-500">Gestión de pedidos</p>
        </div>
        {canCreate ? <Link
          href="/admin/ordenes/nueva"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-wine px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white hover:bg-wine-light"
        >
          <Plus size={15} />
          Crear pedido
        </Link> : null}
      </div>

      <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 text-stone-500">
            <Filter size={14} className="text-stone-500" />
            <span className="text-sm">Filtrar</span>
          </div>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="w-full cursor-pointer rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600 focus:outline-none sm:w-[260px]"
          >
            <option value="">Todos los estados</option>
            {ALL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 size={28} className="mx-auto animate-spin text-wine" />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-stone-500">
            <ShoppingBag size={40} className="mx-auto mb-3 text-stone-200" />
            <p>No hay órdenes</p>
          </div>
        ) : (
          <>
            <div className="xl:hidden space-y-4 p-4">
              {orders.map((order) => (
                <article key={order.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="whitespace-nowrap font-mono text-base font-medium text-stone-900">{order.orderNumber}</h2>
                      <p className="mt-1 text-sm text-stone-500">
                        {order.comprador?.nombre ?? order.user?.nombre} {order.comprador?.apellido ?? order.user?.apellido}
                      </p>
                      {!order.user ? <p className="text-xs text-stone-500">Invitado</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide ${TIER_BADGE_CLASS}`}>
                        {TIER_LABELS[order.tierAtPurchase] || order.tierAtPurchase}
                      </span>
                      <PaymentMethodIndicator metodoPago={order.metodoPago} />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <span className="block text-xs uppercase tracking-wider text-stone-500">Items</span>
                      <span className="mt-1 block text-sm text-stone-600">{order.items?.reduce((sum, item) => sum + item.cantidad, 0) || 0}</span>
                    </div>
                    <div>
                      <span className="block text-xs uppercase tracking-wider text-stone-500">Total</span>
                      <span className="mt-1 block text-sm font-medium text-stone-700">{formatCOP(order.total)}</span>
                    </div>
                    <div>
                      <span className="block text-xs uppercase tracking-wider text-stone-500">Pago</span>
                      <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${PAYMENT_STATUS_BADGE_CLASSES[paymentStatusTone(order.paymentStatus)]}`}>
                        {paymentStatusLabel(order.paymentStatus)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs uppercase tracking-wider text-stone-500">Pedido</span>
                      <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES[order.status] || ''}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-stone-500">
                    {formatDate(order.createdAt)}
                  </div>

                  <div className="mt-4">
                    <OrderActionButtons
                      order={order}
                      onRequestMarkPaid={requestMarkPaid}
                      onConfirmOrder={confirmOrder}
                      onOpenDetail={openDetail}
                      canMarkPaid={canMarkPaid}
                      canConfirm={canConfirm}
                    />
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden xl:block overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-xs uppercase tracking-wider text-stone-600">
                    <th className="px-3 py-3 text-left font-semibold">Orden</th>
                    <th className="px-3 py-3 text-left font-semibold">Cliente</th>
                    <th className="px-3 py-3 text-right font-semibold">Total</th>
                    <th className="px-3 py-3 text-left font-semibold">Método</th>
                    <th className="px-3 py-3 text-left font-semibold">Estado</th>
                    <th className="px-3 py-3 text-left font-semibold">Fecha</th>
                    <th className="sticky right-0 bg-white px-3 py-3 text-right font-semibold shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => (
                    <tr
                      key={order.id}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-ivory'} transition-colors hover:bg-stone-50`}
                    >
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-sm font-medium text-stone-900">{order.orderNumber}</td>
                      <td className="px-3 py-3 text-stone-800">
                        <span className="block whitespace-nowrap">{order.comprador?.nombre ?? order.user?.nombre} {order.comprador?.apellido ?? order.user?.apellido}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-stone-600">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TIER_BADGE_CLASS}`}>{TIER_LABELS[order.tierAtPurchase] || order.tierAtPurchase}</span>
                          {!order.user ? 'Invitado' : null}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                        <span className="block font-medium text-stone-900">{formatCOP(order.total)}</span>
                        <span className="text-xs text-stone-600">{((n) => `${n} ${n === 1 ? 'ítem' : 'ítems'}`)(order.items?.reduce((sum, item) => sum + item.cantidad, 0) || 0)}</span>
                      </td>
                      <td className="px-3 py-3">
                        <PaymentMethodIndicator metodoPago={order.metodoPago} />
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex flex-col items-start gap-1">
                          <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${PAYMENT_STATUS_BADGE_CLASSES[paymentStatusTone(order.paymentStatus)]}`}>
                            {paymentStatusLabel(order.paymentStatus)}
                          </span>
                          <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[order.status] || ''}`}>
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-stone-700">{formatDate(order.createdAt)}</td>
                      <td className={`sticky right-0 w-[1%] px-3 py-3 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)] ${index % 2 === 0 ? 'bg-white' : 'bg-ivory'}`}>
                        <OrderActionButtons
                          order={order}
                          onRequestMarkPaid={requestMarkPaid}
                          onConfirmOrder={confirmOrder}
                          onOpenDetail={openDetail}
                          canMarkPaid={canMarkPaid}
                          canConfirm={canConfirm}
                          inline
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {meta && totalPages > 1 ? (
          <div className="flex flex-col gap-3 border-t border-stone-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs text-stone-500">{meta.total} órdenes</p>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="cursor-pointer rounded border border-stone-200 p-2 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 text-xs text-stone-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="cursor-pointer rounded border border-stone-200 p-2 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {(selectedOrder || detailLoading) ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedOrder(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute right-4 top-4 cursor-pointer text-stone-500 hover:text-stone-600"
            >
              <X size={18} />
            </button>

            {detailLoading ? (
              <div className="py-20 text-center">
                <Loader2 size={28} className="mx-auto animate-spin text-wine" />
              </div>
            ) : selectedOrder ? (
              <div className="p-6 sm:p-7">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <h3 className="text-xl font-semibold text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                    {selectedOrder.orderNumber}
                  </h3>
                  <button
                    type="button"
                    onClick={() => downloadInvoice(selectedOrder.id, selectedOrder.orderNumber)}
                    disabled={downloadingInvoice}
                    className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {downloadingInvoice ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                    Descargar factura
                  </button>
                </div>
                <p className="mb-6 text-sm text-stone-500">{formatDate(selectedOrder.createdAt)}</p>

                {selectedOrder.user ? (
                  <div className="mb-4 rounded-lg bg-ivory p-4 text-sm">
                    <p className="font-medium text-stone-700">{selectedOrder.user.nombre} {selectedOrder.user.apellido}</p>
                    <p className="break-all text-stone-500">{selectedOrder.user.email}</p>
                    {selectedOrder.comprador?.telefono ? <p className="text-stone-500">{selectedOrder.comprador.telefono}</p> : null}
                    <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${TIER_BADGE_CLASS}`}>
                      {TIER_LABELS[selectedOrder.user.tier] || selectedOrder.user.tier}
                    </span>
                    {renderShippingSummary(selectedOrder.direccionEnvio)}
                  </div>
                ) : selectedOrder.comprador ? (
                  <div className="mb-4 rounded-lg bg-ivory p-4 text-sm">
                    <div className="mb-2 flex items-center gap-2">
                      <MessageCircle size={14} className="text-emerald-600" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Pedido manual · WhatsApp</span>
                    </div>
                    <p className="font-medium text-stone-700">{selectedOrder.comprador.nombre} {selectedOrder.comprador.apellido}</p>
                    <p className="text-stone-500">{selectedOrder.comprador.telefono}</p>
                    {selectedOrder.comprador.correo ? <p className="break-all text-stone-500">{selectedOrder.comprador.correo}</p> : null}
                    {renderShippingSummary(selectedOrder.direccionEnvio)}
                  </div>
                ) : null}

                <div className="mb-4 space-y-2">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="flex flex-col gap-1 border-b border-stone-100 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <span className="text-stone-700">{item.nombreProducto}</span>
                        <span className="ml-2 text-xs text-stone-500">{item.sku} × {item.cantidad}</span>
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

                {selectedOrder.notas ? (
                  <div className="mb-4 rounded-lg border border-stone-100 p-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-stone-500">Nota administrativa</p>
                    <p className="text-sm text-stone-600">{selectedOrder.notas}</p>
                  </div>
                ) : null}

                <div className="mb-6 rounded-lg bg-ivory p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Estado del pago y del pedido</p>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <PaymentMethodIndicator metodoPago={selectedOrder.metodoPago} />
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${PAYMENT_STATUS_BADGE_CLASSES[paymentStatusTone(selectedOrder.paymentStatus)]}`}>
                      {paymentStatusLabel(selectedOrder.paymentStatus)}
                    </span>
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES[selectedOrder.status] || ''}`}>
                      {STATUS_LABELS[selectedOrder.status] || selectedOrder.status}
                    </span>
                  </div>
                  <PaymentStageBar
                    paymentApproved={isPaymentApproved(selectedOrder.paymentStatus)}
                    orderConfirmed={selectedOrder.status === 'confirmed'}
                  />
                  {selectedOrder.paymentMarkedPaidByAdmin ? (
                    <p className="mt-3 text-xs text-stone-500">
                      Marcado como pagado por <span className="font-medium text-stone-600">{selectedOrder.paymentMarkedPaidByAdmin}</span>
                      {selectedOrder.paidAt ? ` · ${formatDateTime(selectedOrder.paidAt)}` : ''}
                    </p>
                  ) : null}
                </div>

                {canUpdateStatus ? <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Acciones</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrder.status === 'pending' && (canConfirm || canMarkPaid) ? (
                      isPaymentApproved(selectedOrder.paymentStatus) ? (
                        canConfirm ? (
                          <button
                            onClick={() => confirmOrder(selectedOrder.id)}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                          >
                            <CheckCircle2 size={14} />
                            Confirmar pedido
                          </button>
                        ) : null
                      ) : canMarkPaid ? (
                        <button
                          onClick={() => requestMarkPaid(selectedOrder)}
                          className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
                        >
                          <Banknote size={14} />
                          Marcar como pagado
                        </button>
                      ) : canConfirm ? (
                        <span className="rounded-lg bg-stone-100 px-4 py-2 text-xs font-medium text-stone-500">
                          Esperando pago aprobado para poder confirmar
                        </span>
                      ) : null
                    ) : null}

                    {/* Preparado/Enviado/Entregado: de bodega (y admin), no de comercial. Enviado pide una guía opcional. */}
                    {STATUS_FLOW[selectedOrder.status] && canRoleSetOrderStatus(role, STATUS_FLOW[selectedOrder.status]) ? (
                      <button
                        onClick={() => (
                          STATUS_FLOW[selectedOrder.status] === 'shipped'
                            ? requestShip(selectedOrder.id)
                            : changeStatus(selectedOrder.id, STATUS_FLOW[selectedOrder.status])
                        )}
                        className="cursor-pointer rounded-lg bg-wine px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-wine-light"
                      >
                        → {STATUS_LABELS[STATUS_FLOW[selectedOrder.status]]}
                      </button>
                    ) : null}

                    {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && canRoleSetOrderStatus(role, 'cancelled') ? (
                      <button
                        onClick={() => changeStatus(selectedOrder.id, 'cancelled')}
                        className="cursor-pointer rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>

                  {shipDialog?.id === selectedOrder.id ? (
                    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-stone-200 bg-ivory p-3">
                      <label className="flex-1 min-w-[180px] text-xs text-stone-600">
                        Guía de envío (opcional)
                        <input
                          type="text"
                          value={shipDialog.guia}
                          onChange={(e) => setShipDialog({ ...shipDialog, guia: e.target.value })}
                          placeholder="N.º de guía de la transportadora"
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-wine focus:outline-none"
                        />
                      </label>
                      <button
                        onClick={confirmShipAction}
                        disabled={shipping}
                        className="cursor-pointer rounded-lg bg-wine px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-wine-light disabled:opacity-60"
                      >
                        {shipping ? 'Marcando…' : 'Marcar enviado'}
                      </button>
                      <button
                        onClick={() => setShipDialog(null)}
                        disabled={shipping}
                        className="cursor-pointer rounded-lg border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : null}
                </div> : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <Dialog
        open={confirmMarkPaid?.metodoPago === 'online'}
        title="Marcar pedido en línea como pagado"
        onClose={() => setConfirmMarkPaid(null)}
        footer={
          <>
            <button type="button" onClick={() => setConfirmMarkPaid(null)} className="cursor-pointer rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Cancelar</button>
            <button type="button" disabled={markingPaid} onClick={confirmMarkPaidAction} className="cursor-pointer rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60">{markingPaid ? 'Verificando...' : 'Marcar como pagado'}</button>
          </>
        }
      >
        <p className="mb-3">
          El pedido {confirmMarkPaid?.orderNumber} se creó con pago en línea, pero el cliente pagó por otro medio. Antes de aprobarlo se verifica en Mercado Pago que no exista un pago registrado.
        </p>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-stone-500" htmlFor="online-pay-method">¿Cómo pagó el cliente?</label>
        <select
          id="online-pay-method"
          value={onlinePayMethod}
          onChange={(e) => setOnlinePayMethod(e.target.value as typeof onlinePayMethod)}
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-wine/40 focus:outline-none"
        >
          {ONLINE_PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <p className="mt-3 text-xs text-stone-500">Queda registrado a tu nombre con el método elegido. El enlace de pago en línea se desactiva.</p>
      </Dialog>

      <ConfirmDialog
        open={confirmMarkPaid?.metodoPago === 'whatsapp'}
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
