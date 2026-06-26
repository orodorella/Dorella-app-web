'use client';

import { useState, useEffect, useCallback } from 'react';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { useToast } from '@/context/ToastProvider';
import { ShoppingBag, ChevronLeft, ChevronRight, Loader2, X, Filter } from 'lucide-react';

const TIER_LABELS: Record<string, string> = { detal: 'Detal', por_mayor: 'Por Mayor', gran_mayor: 'Gran Mayor' };
const TIER_COLORS: Record<string, string> = { detal: 'bg-stone-100 text-stone-600', por_mayor: 'bg-gold/10 text-gold-dark border border-gold/20', gran_mayor: 'bg-wine/10 text-wine border border-wine/20' };
const STATUS_STYLES: Record<string, string> = { pending: 'bg-amber-50 text-amber-700', confirmed: 'bg-blue-50 text-blue-700', invoiced: 'bg-blue-50 text-blue-700', shipped: 'bg-purple-50 text-purple-700', delivered: 'bg-emerald-50 text-emerald-700', cancelled: 'bg-red-50 text-red-700' };
const STATUS_LABELS: Record<string, string> = { pending: 'Pendiente', confirmed: 'Confirmado', invoiced: 'Facturado', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado' };
const ALL_STATUSES = ['pending', 'confirmed', 'invoiced', 'shipped', 'delivered', 'cancelled'];
const STATUS_FLOW: Record<string, string> = { pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered' };

interface OrderItem { id: string; sku: string; nombreProducto: string; cantidad: number; precioUnitario: number; subtotal: number; }
interface OrderRow { id: string; orderNumber: string; status: string; tierAtPurchase: string; total: number; createdAt: string; user?: { nombre: string; apellido: string; email: string; tier: string }; items: OrderItem[]; }
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

  const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 1;

  return (
    <div>
      <h1 className="text-3xl text-stone-800 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Órdenes</h1>
      <p className="text-sm text-stone-400 mb-8">Gestión de pedidos</p>

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
                <th className="text-right px-6 py-3 font-medium">Total</th><th className="text-left px-6 py-3 font-medium">Estado</th>
                <th className="text-left px-6 py-3 font-medium">Fecha</th><th className="text-center px-6 py-3 font-medium">Acciones</th>
              </tr></thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={o.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-ivory/50'} hover:bg-stone-50 transition-colors`}>
                    <td className="px-6 py-3.5 font-medium text-stone-700">{o.orderNumber}</td>
                    <td className="px-6 py-3.5 text-stone-600">{o.user?.nombre} {o.user?.apellido}</td>
                    <td className="px-6 py-3.5"><span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${TIER_COLORS[o.tierAtPurchase] || ''}`}>{TIER_LABELS[o.tierAtPurchase] || o.tierAtPurchase}</span></td>
                    <td className="px-6 py-3.5 text-center text-stone-500">{o.items?.reduce((s, it) => s + it.cantidad, 0) || 0}</td>
                    <td className="px-6 py-3.5 text-right font-medium text-stone-700" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCOP(o.total)}</td>
                    <td className="px-6 py-3.5"><span className={`text-[9px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_STYLES[o.status] || ''}`}>{STATUS_LABELS[o.status] || o.status}</span></td>
                    <td className="px-6 py-3.5 text-stone-400 text-xs">{new Date(o.createdAt).toLocaleDateString('es-CO')}</td>
                    <td className="px-6 py-3.5 text-center"><button onClick={() => openDetail(o.id)} className="text-xs text-wine hover:text-wine-light cursor-pointer px-3 py-1.5 border border-stone-200 rounded hover:border-wine/20 transition-colors">Detalle</button></td>
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
                <div className="space-y-2 mb-4">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm py-2 border-b border-stone-100">
                      <div><span className="text-stone-700">{item.nombreProducto}</span><span className="text-stone-400 text-xs ml-2">{item.sku} × {item.cantidad}</span></div>
                      <span className="font-medium text-stone-700" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCOP(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-baseline mb-6 pt-2 border-t border-stone-200">
                  <span className="font-semibold text-stone-600">Total</span>
                  <span className="text-xl font-bold text-wine">{formatCOP(selectedOrder.total)}</span>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Cambiar estado</p>
                  <div className="flex flex-wrap gap-2">
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
