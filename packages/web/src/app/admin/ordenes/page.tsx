'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { useToast } from '@/context/ToastProvider';
import { ShoppingBag, ChevronLeft, ChevronRight, Loader2, X, Filter, CheckCircle2, Plus, MessageCircle, Banknote } from 'lucide-react';
import { PAYMENT_STATUS_BADGE_CLASSES, isPaymentApproved, paymentStatusLabel, paymentStatusTone } from '@/lib/payment-status';
import { PaymentStageBar } from '@/components/pedidos/PaymentStageBar';

const TIER_LABELS: Record<string, string> = { detal: 'Detal', por_mayor: 'Por Mayor', gran_mayor: 'Gran Mayor' };
const TIER_COLORS: Record<string, string> = { detal: 'bg-stone-100 text-stone-600', por_mayor: 'bg-gold/10 text-gold-dark border border-gold/20', gran_mayor: 'bg-wine/10 text-wine border border-wine/20' };
const STATUS_STYLES: Record<string, string> = { pending: 'bg-amber-50 text-amber-700', confirmed: 'bg-blue-50 text-blue-700', invoiced: 'bg-blue-50 text-blue-700', shipped: 'bg-purple-50 text-purple-700', delivered: 'bg-emerald-50 text-emerald-700', cancelled: 'bg-red-50 text-red-700' };
const STATUS_LABELS: Record<string, string> = { pending: 'Pendiente de confirmación', confirmed: 'Pedido confirmado', invoiced: 'Facturado', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado' };
const ALL_STATUSES = ['pending', 'confirmed', 'invoiced', 'shipped', 'delivered', 'cancelled'];
// 'pending' -> 'confirmed' is intentionally NOT here: that transition only
// happens through the dedicated "Confirmar pedido" action below, which is
// gated on the payment actually being approved.
const STATUS_FLOW: Record<string, string> = { confirmed: 'shipped', shipped: 'delivered' };

interface OrderItem { id: string; sku: string; nombreProducto: string; cantidad: number; precioUnitario: number; subtotal: number; }
interface OrderRow {
  id: string; orderNumber: string; status: string; paymentStatus: string | null; tierAtPurchase: string;
  total: number; createdAt: string; origen: string; notas?: string | null;
  comprador?: { nombre: string; apellido: string; telefono: string; correo: string | null } | null;
  direccionEnvio?: { direccion?: string; ciudad?: string; informacionAdicional?: string } | null;
  user?: { nombre: string; apellido: string; email: string; tier: string } | null; items: OrderItem[];
}
interface Meta { page: number; pageSize: number; total: number; }

export default function AdminOrdenesPage() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadOrders = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page)); qs.set('pageSize', '10');
    if (statusFilter) qs.set('status', statusFilter);
    request('GET', `/api/admin/orders?${qs}`)
      .then((res) => { if (res.success) { setOrders(res.data); setMeta(res.meta); } })
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [page, statusFilter, showToast]);

  useEffect(() => { loadOrders(); }, [loadOrders]);
  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get('open');
    if (orderId) openDetail(orderId);
  }, []);

  function openDetail(orderId: string) {
    setDetailLoading(true);
    request('GET', `/api/admin/orders/${orderId}`)
      .then((res) => { if (res.success) setSelectedOrder(res.data); })
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setDetailLoading(false));
  }

  async function changeStatus(orderId: string, status: string) {
    try {
      await request('PATCH', `/api/admin/orders/${orderId}/status`, { status });
      showToast(`Estado cambiado a ${STATUS_LABELS[status]}`);
      loadOrders();
      if (selectedOrder?.id === orderId) openDetail(orderId);
    } catch (e) { showToast((e as Error).message, 'error'); }
  }

  async function confirmOrder(orderId: string) {
    try {
      await request('POST', `/api/admin/orders/${orderId}/confirm`);
      showToast('Pedido confirmado');
      loadOrders();
      if (selectedOrder?.id === orderId) openDetail(orderId);
    } catch (e) { showToast((e as Error).message, 'error'); }
  }

  async function markPaid(orderId: string) {
    try {
      await request('POST', `/api/admin/orders/${orderId}/mark-paid`);
      showToast('Pedido marcado como pagado');
      loadOrders();
      if (selectedOrder?.id === orderId) openDetail(orderId);
    } catch (e) { showToast((e as Error).message, 'error'); }
  }

  const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 1;

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h1 className="text-3xl text-stone-800 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Órdenes</h1><p className="text-sm text-stone-400">Gestión de pedidos</p></div>
        <Link href="/admin/ordenes/nueva" className="inline-flex items-center justify-center gap-2 rounded-lg bg-wine px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white hover:bg-wine-light"><Plus size={15} /> Crear pedido</Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Filter size={14} className="text-stone-400" />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-600 cursor-pointer focus:outline-none">
          <option value="">Todos los estados</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        {loading ? <div className="text-center py-16"><Loader2 size={28} className="animate-spin text-wine mx-auto" /></div>
        : orders.length === 0 ? <div className="text-center py-16 text-stone-400"><ShoppingBag size={40} className="mx-auto mb-3 text-stone-200" /><p>No hay órdenes</p></div>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] text-stone-400 uppercase tracking-wider border-b border-stone-100">
                <th className="text-left px-6 py-3 font-medium">Orden</th><th className="text-left px-6 py-3 font-medium">Usuario</th>
                <th className="text-left px-6 py-3 font-medium">Tier</th><th className="text-center px-6 py-3 font-medium">Items</th>
                <th className="text-right px-6 py-3 font-medium">Total</th><th className="text-left px-6 py-3 font-medium">Pago</th>
                <th className="text-left px-6 py-3 font-medium">Pedido</th>
                <th className="text-left px-6 py-3 font-medium">Fecha</th><th className="text-center px-6 py-3 font-medium">Acciones</th>
              </tr></thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={o.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-ivory/50'} hover:bg-stone-50 transition-colors`}>
                    <td className="px-6 py-3.5 font-medium text-stone-700"><div>{o.orderNumber}</div>{o.origen === 'whatsapp' && <span className="mt-1 inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-emerald-700"><MessageCircle size={10} /> WhatsApp</span>}</td>
                    <td className="px-6 py-3.5 text-stone-600">{o.comprador?.nombre ?? o.user?.nombre} {o.comprador?.apellido ?? o.user?.apellido}{!o.user && <span className="block text-[10px] text-stone-400">Invitado</span>}</td>
                    <td className="px-6 py-3.5"><span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${TIER_COLORS[o.tierAtPurchase] || ''}`}>{TIER_LABELS[o.tierAtPurchase] || o.tierAtPurchase}</span></td>
                    <td className="px-6 py-3.5 text-center text-stone-500">{o.items?.reduce((s, it) => s + it.cantidad, 0) || 0}</td>
                    <td className="px-6 py-3.5 text-right font-medium text-stone-700" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCOP(o.total)}</td>
                    <td className="px-6 py-3.5"><span className={`text-[9px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${PAYMENT_STATUS_BADGE_CLASSES[paymentStatusTone(o.paymentStatus)]}`}>{paymentStatusLabel(o.paymentStatus)}</span></td>
                    <td className="px-6 py-3.5"><span className={`text-[9px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_STYLES[o.status] || ''}`}>{STATUS_LABELS[o.status] || o.status}</span></td>
                    <td className="px-6 py-3.5 text-stone-400 text-xs">{new Date(o.createdAt).toLocaleDateString('es-CO')}</td>
                    <td className="px-6 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {o.origen === 'whatsapp' && !isPaymentApproved(o.paymentStatus) && (
                          <button onClick={() => markPaid(o.id)}
                            className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 cursor-pointer px-3 py-1.5 border border-amber-200 bg-amber-50 rounded hover:bg-amber-100 transition-colors">
                            <Banknote size={13} /> Marcar pagado
                          </button>
                        )}
                        {o.status === 'pending' && isPaymentApproved(o.paymentStatus) && (
                          <button onClick={() => confirmOrder(o.id)}
                            className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 cursor-pointer px-3 py-1.5 border border-emerald-200 bg-emerald-50 rounded hover:bg-emerald-100 transition-colors">
                            <CheckCircle2 size={13} /> Confirmar
                          </button>
                        )}
                        <button onClick={() => openDetail(o.id)} className="text-xs text-wine hover:text-wine-light cursor-pointer px-3 py-1.5 border border-stone-200 rounded hover:border-wine/20 transition-colors">Detalle</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100">
            <p className="text-xs text-stone-400">{meta.total} órdenes</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-2 border border-stone-200 rounded disabled:opacity-30 cursor-pointer hover:bg-stone-50"><ChevronLeft size={14} /></button>
              <span className="text-xs text-stone-500 px-2">{page} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-2 border border-stone-200 rounded disabled:opacity-30 cursor-pointer hover:bg-stone-50"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {(selectedOrder || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedOrder(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedOrder(null)} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 cursor-pointer"><X size={18} /></button>
            {detailLoading ? <div className="py-20 text-center"><Loader2 size={28} className="animate-spin text-wine mx-auto" /></div>
            : selectedOrder && (
              <div className="p-6">
                <h3 className="text-xl font-semibold text-stone-800 mb-1" style={{ fontFamily: 'var(--font-display)' }}>{selectedOrder.orderNumber}</h3>
                <p className="text-sm text-stone-400 mb-6">{new Date(selectedOrder.createdAt).toLocaleDateString('es-CO')}</p>
                {selectedOrder.user && (
                  <div className="bg-ivory rounded-lg p-4 mb-4 text-sm">
                    <p className="font-medium text-stone-700">{selectedOrder.user.nombre} {selectedOrder.user.apellido}</p>
                    <p className="text-stone-500">{selectedOrder.user.email}</p>
                    <span className={`inline-block mt-1 text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${TIER_COLORS[selectedOrder.user.tier] || ''}`}>{TIER_LABELS[selectedOrder.user.tier] || selectedOrder.user.tier}</span>
                  </div>
                )}
                {!selectedOrder.user && selectedOrder.comprador && (
                  <div className="bg-ivory rounded-lg p-4 mb-4 text-sm">
                    <div className="mb-2 flex items-center gap-2"><MessageCircle size={14} className="text-emerald-600" /><span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Pedido manual · WhatsApp</span></div>
                    <p className="font-medium text-stone-700">{selectedOrder.comprador.nombre} {selectedOrder.comprador.apellido}</p>
                    <p className="text-stone-500">{selectedOrder.comprador.telefono}</p>
                    {selectedOrder.comprador.correo && <p className="text-stone-500">{selectedOrder.comprador.correo}</p>}
                    {selectedOrder.direccionEnvio && <p className="mt-2 text-xs text-stone-500">{selectedOrder.direccionEnvio.direccion}, {selectedOrder.direccionEnvio.ciudad}{selectedOrder.direccionEnvio.informacionAdicional ? ` · ${selectedOrder.direccionEnvio.informacionAdicional}` : ''}</p>}
                  </div>
                )}
                <div className="space-y-2 mb-4">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm py-2 border-b border-stone-100">
                      <div><span className="text-stone-700">{item.nombreProducto}</span><span className="text-stone-400 text-xs ml-2">{item.sku} × {item.cantidad}</span></div>
                      <span className="font-medium text-stone-700" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCOP(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-baseline mb-4 pt-2 border-t border-stone-200">
                  <span className="font-semibold text-stone-600">Total</span>
                  <span className="text-xl font-bold text-wine">{formatCOP(selectedOrder.total)}</span>
                </div>
                {selectedOrder.notas && <div className="mb-4 rounded-lg border border-stone-100 p-3"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Nota administrativa</p><p className="text-sm text-stone-600">{selectedOrder.notas}</p></div>}

                <div className="mb-6 rounded-lg bg-ivory p-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Estado del pago y del pedido</p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${PAYMENT_STATUS_BADGE_CLASSES[paymentStatusTone(selectedOrder.paymentStatus)]}`}>
                      {paymentStatusLabel(selectedOrder.paymentStatus)}
                    </span>
                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_STYLES[selectedOrder.status] || ''}`}>
                      {STATUS_LABELS[selectedOrder.status] || selectedOrder.status}
                    </span>
                  </div>
                  <PaymentStageBar
                    paymentApproved={isPaymentApproved(selectedOrder.paymentStatus)}
                    orderConfirmed={selectedOrder.status === 'confirmed'}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Acciones</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrder.status === 'pending' && (
                      isPaymentApproved(selectedOrder.paymentStatus) ? (
                        <button onClick={() => confirmOrder(selectedOrder.id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-emerald-700 transition-colors">
                          <CheckCircle2 size={14} /> Confirmar pedido
                        </button>
                      ) : selectedOrder.origen === 'whatsapp' ? (
                        <button onClick={() => markPaid(selectedOrder.id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-amber-600 transition-colors">
                          <Banknote size={14} /> Marcar como pagado
                        </button>
                      ) : (
                        <span className="px-4 py-2 rounded-lg text-xs font-medium bg-stone-100 text-stone-400">
                          Esperando pago aprobado para poder confirmar
                        </span>
                      )
                    )}
                    {STATUS_FLOW[selectedOrder.status] && (
                      <button onClick={() => changeStatus(selectedOrder.id, STATUS_FLOW[selectedOrder.status])}
                        className="px-4 py-2 bg-wine text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-wine-light transition-colors">→ {STATUS_LABELS[STATUS_FLOW[selectedOrder.status]]}</button>
                    )}
                    {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && (
                      <button onClick={() => changeStatus(selectedOrder.id, 'cancelled')}
                        className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-xs font-semibold cursor-pointer hover:bg-red-50 transition-colors">Cancelar</button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
