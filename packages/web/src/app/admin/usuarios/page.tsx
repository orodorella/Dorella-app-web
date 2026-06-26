'use client';

import { useState, useEffect, useCallback } from 'react';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { useToast } from '@/context/ToastProvider';
import { Search, Users, ChevronLeft, ChevronRight, Loader2, X, ShoppingBag } from 'lucide-react';

const TIER_LABELS: Record<string, string> = { detal: 'Detal', por_mayor: 'Por Mayor', gran_mayor: 'Gran Mayor' };
const TIER_COLORS: Record<string, string> = { detal: 'bg-stone-100 text-stone-600', por_mayor: 'bg-gold/10 text-gold-dark border border-gold/20', gran_mayor: 'bg-wine/10 text-wine border border-wine/20' };
const TIERS = ['detal', 'por_mayor', 'gran_mayor'];

interface UserRow { id: string; nombre: string; apellido: string; email: string; tier: string; empresa: string | null; totalComprasAcumulado: number; createdAt: string; }
interface UserDetail extends UserRow { ciudad: string | null; orders: Array<{ id: string; orderNumber: string; total: number; createdAt: string }>; }
interface Meta { page: number; pageSize: number; total: number; }

export default function AdminUsuariosPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadUsers = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('pageSize', '10');
    if (search) qs.set('search', search);
    if (tierFilter) qs.set('tier', tierFilter);
    request('GET', `/api/admin/users?${qs}`)
      .then((res) => { if (res.success) { setUsers(res.data); setMeta(res.meta); } })
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [page, tierFilter, search, showToast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  function handleSearch(e: React.FormEvent) { e.preventDefault(); setPage(1); loadUsers(); }

  function openDetail(userId: string) {
    setDetailLoading(true);
    request('GET', `/api/admin/users/${userId}`)
      .then((res) => { if (res.success) setSelectedUser(res.data); })
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setDetailLoading(false));
  }

  async function changeTier(userId: string, newTier: string) {
    if (!confirm(`¿Cambiar tier a ${TIER_LABELS[newTier]}?`)) return;
    try {
      await request('PATCH', `/api/admin/users/${userId}/tier`, { tier: newTier });
      showToast('Tier actualizado');
      loadUsers();
      if (selectedUser?.id === userId) openDetail(userId);
    } catch (e) { showToast((e as Error).message, 'error'); }
  }

  const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 1;

  return (
    <div>
      <h1 className="text-3xl text-stone-800 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Usuarios</h1>
      <p className="text-sm text-stone-400 mb-8">Gestión de clientes y tiers</p>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
          <input type="text" placeholder="Buscar por nombre o email..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-300" />
        </form>
        <select value={tierFilter} onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-600 cursor-pointer focus:outline-none">
          <option value="">Todos los tiers</option>
          {TIERS.map((t) => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        {loading ? <div className="text-center py-16"><Loader2 size={28} className="animate-spin text-wine mx-auto" /></div>
        : users.length === 0 ? <div className="text-center py-16 text-stone-400"><Users size={40} className="mx-auto mb-3 text-stone-200" /><p>No se encontraron usuarios</p></div>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] text-stone-400 uppercase tracking-wider border-b border-stone-100">
                <th className="text-left px-6 py-3 font-medium">Nombre</th><th className="text-left px-6 py-3 font-medium">Email</th>
                <th className="text-left px-6 py-3 font-medium">Tier</th><th className="text-left px-6 py-3 font-medium">Empresa</th>
                <th className="text-right px-6 py-3 font-medium">Compras</th><th className="text-left px-6 py-3 font-medium">Registro</th>
                <th className="text-center px-6 py-3 font-medium">Acciones</th>
              </tr></thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-ivory/50'} hover:bg-stone-50 transition-colors`}>
                    <td className="px-6 py-3.5 font-medium text-stone-700">{u.nombre} {u.apellido}</td>
                    <td className="px-6 py-3.5 text-stone-500">{u.email}</td>
                    <td className="px-6 py-3.5">
                      <select value={u.tier} onChange={(e) => changeTier(u.id, e.target.value)}
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full cursor-pointer border-none focus:outline-none ${TIER_COLORS[u.tier] || ''}`}>
                        {TIERS.map((t) => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
                      </select>
                    </td>
                    <td className="px-6 py-3.5 text-stone-500">{u.empresa || '—'}</td>
                    <td className="px-6 py-3.5 text-right font-medium text-stone-700" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCOP(u.totalComprasAcumulado)}</td>
                    <td className="px-6 py-3.5 text-stone-400 text-xs">{new Date(u.createdAt).toLocaleDateString('es-CO')}</td>
                    <td className="px-6 py-3.5 text-center">
                      <button onClick={() => openDetail(u.id)} className="text-xs text-wine hover:text-wine-light cursor-pointer px-3 py-1.5 border border-stone-200 rounded hover:border-wine/20 transition-colors">Ver detalle</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100">
            <p className="text-xs text-stone-400">{meta.total} usuarios</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-2 border border-stone-200 rounded disabled:opacity-30 cursor-pointer hover:bg-stone-50"><ChevronLeft size={14} /></button>
              <span className="text-xs text-stone-500 px-2">{page} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-2 border border-stone-200 rounded disabled:opacity-30 cursor-pointer hover:bg-stone-50"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {(selectedUser || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 cursor-pointer"><X size={18} /></button>
            {detailLoading ? <div className="py-20 text-center"><Loader2 size={28} className="animate-spin text-wine mx-auto" /></div>
            : selectedUser && (
              <div className="p-6">
                <h3 className="text-xl font-semibold text-stone-800 mb-1" style={{ fontFamily: 'var(--font-display)' }}>{selectedUser.nombre} {selectedUser.apellido}</h3>
                <p className="text-sm text-stone-400 mb-6">{selectedUser.email}</p>
                <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                  <div><span className="text-[10px] text-stone-400 uppercase tracking-wider block">Tier</span><span className={`inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${TIER_COLORS[selectedUser.tier] || ''}`}>{TIER_LABELS[selectedUser.tier]}</span></div>
                  <div><span className="text-[10px] text-stone-400 uppercase tracking-wider block">Compras</span><span className="font-medium text-stone-700">{formatCOP(selectedUser.totalComprasAcumulado)}</span></div>
                  <div><span className="text-[10px] text-stone-400 uppercase tracking-wider block">Empresa</span><span className="text-stone-600">{selectedUser.empresa || '—'}</span></div>
                  <div><span className="text-[10px] text-stone-400 uppercase tracking-wider block">Ciudad</span><span className="text-stone-600">{selectedUser.ciudad || '—'}</span></div>
                </div>
                {selectedUser.orders?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2"><ShoppingBag size={14} /> Últimos pedidos</h4>
                    <div className="space-y-2">
                      {selectedUser.orders.map((o) => (
                        <div key={o.id} className="flex justify-between items-center py-2 px-3 bg-ivory rounded text-xs">
                          <span className="font-medium text-stone-700">{o.orderNumber}</span>
                          <span className="text-stone-500">{formatCOP(o.total)}</span>
                          <span className="text-stone-400">{new Date(o.createdAt).toLocaleDateString('es-CO')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
