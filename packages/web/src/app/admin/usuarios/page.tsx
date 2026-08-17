'use client';

import { useState, useEffect, useCallback } from 'react';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/context/ToastProvider';
import { Search, Users, ChevronLeft, ChevronRight, Loader2, X, ShoppingBag, Trash2, ShieldCheck } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const TIER_LABELS: Record<string, string> = {
  detal: 'Detal',
  por_mayor: 'Por Mayor',
  gran_mayor: 'Gran Mayor',
};

const TIER_COLORS: Record<string, string> = {
  detal: 'bg-stone-100 text-stone-600',
  por_mayor: 'border border-gold/20 bg-gold/10 text-gold-dark',
  gran_mayor: 'border border-wine/20 bg-wine/10 text-wine',
};

const TIERS = ['detal', 'por_mayor', 'gran_mayor'];
const ROLE_LABELS: Record<string, string> = { cliente: 'Cliente', admin: 'Administrador' };

interface UserRow {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  tier: string;
  role: string;
  isActive: boolean;
  empresa: string | null;
  totalComprasAcumulado: number;
  createdAt: string;
}

interface UserDetail extends UserRow {
  ciudad: string | null;
  orders: Array<{ id: string; orderNumber: string; total: number; createdAt: string }>;
}

interface Meta {
  page: number;
  pageSize: number;
  total: number;
}

function UserTierBadge({ tier }: { tier: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${TIER_COLORS[tier] || ''}`}>
      {TIER_LABELS[tier] || tier}
    </span>
  );
}

function UserRoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${role === 'admin' ? 'bg-wine/10 text-wine' : 'bg-stone-100 text-stone-500'}`}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

export default function AdminUsuariosPage() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [confirmTier, setConfirmTier] = useState<{ userId: string; nombre: string; tier: string } | null>(null);
  const [confirmRole, setConfirmRole] = useState<{ userId: string; nombre: string; role: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ userId: string; nombre: string } | null>(null);

  const loadUsers = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('pageSize', '10');
    if (search) qs.set('search', search);
    if (tierFilter) qs.set('tier', tierFilter);

    request('GET', `/api/admin/users?${qs}`)
      .then((res) => {
        if (res.success) {
          setUsers(res.data);
          setMeta(res.meta);
        }
      })
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [page, tierFilter, search, showToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    loadUsers();
  }

  function openDetail(userId: string) {
    setDetailLoading(true);
    request('GET', `/api/admin/users/${userId}`)
      .then((res) => {
        if (res.success) setSelectedUser(res.data);
      })
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setDetailLoading(false));
  }

  function changeTier(userId: string, nombre: string, newTier: string) {
    setConfirmTier({ userId, nombre, tier: newTier });
  }

  async function confirmTierChange() {
    if (!confirmTier) return;

    try {
      const res = await request('PATCH', `/api/admin/users/${confirmTier.userId}/tier`, {
        tier: confirmTier.tier,
      });

      if (!res.success) throw new Error(res.error?.message || 'No se pudo cambiar el tier');
      showToast('Tier actualizado');
      loadUsers();
      if (selectedUser?.id === confirmTier.userId) openDetail(confirmTier.userId);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setConfirmTier(null);
    }
  }

  function changeRole(userId: string, nombre: string, newRole: string) {
    setConfirmRole({ userId, nombre, role: newRole });
  }

  async function confirmRoleChange() {
    if (!confirmRole) return;

    try {
      const res = await request('PATCH', `/api/admin/users/${confirmRole.userId}/role`, {
        role: confirmRole.role,
      });

      if (!res.success) throw new Error(res.error?.message || 'No se pudo cambiar el rol');
      showToast('Rol actualizado');
      loadUsers();
      if (selectedUser?.id === confirmRole.userId) openDetail(confirmRole.userId);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setConfirmRole(null);
    }
  }

  function deleteUser(userId: string, nombre: string) {
    setConfirmDelete({ userId, nombre });
  }

  async function confirmDeleteUser() {
    if (!confirmDelete) return;

    try {
      const res = await request('DELETE', `/api/admin/users/${confirmDelete.userId}`);
      if (!res.success) throw new Error(res.error?.message || 'No se pudo eliminar el usuario');
      showToast('Usuario eliminado');
      loadUsers();
      if (selectedUser?.id === confirmDelete.userId) setSelectedUser(null);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setConfirmDelete(null);
    }
  }

  const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 1;

  return (
    <div className="min-w-0">
      <h1 className="mb-1 text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Usuarios</h1>
      <p className="mb-6 text-sm text-stone-400">Gestión de clientes y tiers</p>

      <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <form onSubmit={handleSearch} className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm focus:border-stone-300 focus:outline-none"
            />
          </form>
          <select
            value={tierFilter}
            onChange={(e) => {
              setTierFilter(e.target.value);
              setPage(1);
            }}
            className="w-full cursor-pointer rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600 focus:outline-none lg:w-[220px]"
          >
            <option value="">Todos los tiers</option>
            {TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {TIER_LABELS[tier]}
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
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-stone-400">
            <Users size={40} className="mx-auto mb-3 text-stone-200" />
            <p>No se encontraron usuarios</p>
          </div>
        ) : (
          <>
            <div className="xl:hidden space-y-4 p-4">
              {users.map((user) => (
                <article key={user.id} className={`rounded-2xl border border-stone-200 bg-white p-4 shadow-sm ${!user.isActive ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-medium text-stone-800">
                          {user.nombre} {user.apellido}
                        </h2>
                        {currentUser?.email === user.email ? <ShieldCheck size={14} className="text-wine" /> : null}
                      </div>
                      <p className="mt-1 break-all text-sm text-stone-500">{user.email}</p>
                    </div>
                    {!user.isActive ? (
                      <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                        Eliminado
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <span className="mb-1 block text-[10px] uppercase tracking-wider text-stone-400">Tier</span>
                      <select
                        value={user.tier}
                        disabled={!user.isActive}
                        onChange={(e) => changeTier(user.id, `${user.nombre} ${user.apellido}`, e.target.value)}
                        className={`w-full cursor-pointer rounded-xl border-none px-3 py-2 text-xs font-semibold uppercase tracking-wider focus:outline-none disabled:cursor-not-allowed ${TIER_COLORS[user.tier] || ''}`}
                      >
                        {TIERS.map((tier) => (
                          <option key={tier} value={tier}>
                            {TIER_LABELS[tier]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="mb-1 block text-[10px] uppercase tracking-wider text-stone-400">Rol</span>
                      {user.id !== currentUser?.id ? (
                        <select
                          value={user.role}
                          disabled={!user.isActive}
                          onChange={(e) => changeRole(user.id, `${user.nombre} ${user.apellido}`, e.target.value)}
                          className="w-full cursor-pointer rounded-xl border-none bg-stone-100 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-stone-600 focus:outline-none disabled:cursor-not-allowed"
                        >
                          {Object.entries(ROLE_LABELS).map(([role, label]) => (
                            <option key={role} value={role}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <UserRoleBadge role={user.role} />
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-stone-400">Empresa</span>
                      <span className="mt-1 block text-sm text-stone-600">{user.empresa || '—'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-stone-400">Compras</span>
                      <span className="mt-1 block text-sm font-medium text-stone-700">{formatCOP(user.totalComprasAcumulado)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-stone-400">Registro</span>
                      <span className="mt-1 block text-sm text-stone-500">{new Date(user.createdAt).toLocaleDateString('es-CO')}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => openDetail(user.id)}
                      className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-wine transition-colors hover:border-wine/20 hover:text-wine-light"
                    >
                      Ver detalle
                    </button>
                    {user.isActive && user.id !== currentUser?.id ? (
                      <button
                        onClick={() => deleteUser(user.id, `${user.nombre} ${user.apellido}`)}
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 size={14} />
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden xl:block overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-[10px] uppercase tracking-wider text-stone-400">
                    <th className="px-6 py-3 text-left font-medium">Nombre</th>
                    <th className="px-6 py-3 text-left font-medium">Email</th>
                    <th className="px-6 py-3 text-left font-medium">Tier</th>
                    <th className="px-6 py-3 text-left font-medium">Rol</th>
                    <th className="px-6 py-3 text-left font-medium">Empresa</th>
                    <th className="px-6 py-3 text-right font-medium">Compras</th>
                    <th className="px-6 py-3 text-left font-medium">Registro</th>
                    <th className="px-6 py-3 text-center font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <tr
                      key={user.id}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-ivory/50'} transition-colors hover:bg-stone-50 ${!user.isActive ? 'opacity-50' : ''}`}
                    >
                      <td className="px-6 py-3.5 font-medium text-stone-700">
                        {user.nombre} {user.apellido}
                        {!user.isActive ? (
                          <span className="ml-2 text-[9px] font-semibold uppercase tracking-wider text-stone-400">(Eliminado)</span>
                        ) : null}
                      </td>
                      <td className="px-6 py-3.5 text-stone-500">
                        {user.email}
                        {currentUser?.email === user.email ? <ShieldCheck size={13} className="ml-1.5 inline text-wine" /> : null}
                      </td>
                      <td className="px-6 py-3.5">
                        <select
                          value={user.tier}
                          disabled={!user.isActive}
                          onChange={(e) => changeTier(user.id, `${user.nombre} ${user.apellido}`, e.target.value)}
                          className={`cursor-pointer rounded-full border-none px-2 py-1 text-[10px] font-semibold uppercase tracking-wider focus:outline-none disabled:cursor-not-allowed ${TIER_COLORS[user.tier] || ''}`}
                        >
                          {TIERS.map((tier) => (
                            <option key={tier} value={tier}>
                              {TIER_LABELS[tier]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-3.5">
                        {user.id !== currentUser?.id ? (
                          <select
                            value={user.role}
                            disabled={!user.isActive}
                            onChange={(e) => changeRole(user.id, `${user.nombre} ${user.apellido}`, e.target.value)}
                            className="cursor-pointer rounded-full border-none bg-stone-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-600 focus:outline-none disabled:cursor-not-allowed"
                          >
                            {Object.entries(ROLE_LABELS).map(([role, label]) => (
                              <option key={role} value={role}>
                                {label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <UserRoleBadge role={user.role} />
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-stone-500">{user.empresa || '—'}</td>
                      <td className="px-6 py-3.5 text-right font-medium text-stone-700" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCOP(user.totalComprasAcumulado)}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-stone-400">
                        {new Date(user.createdAt).toLocaleDateString('es-CO')}
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openDetail(user.id)}
                            className="cursor-pointer rounded border border-stone-200 px-3 py-1.5 text-xs text-wine transition-colors hover:border-wine/20 hover:text-wine-light"
                          >
                            Ver detalle
                          </button>
                          {user.isActive && user.id !== currentUser?.id ? (
                            <button
                              onClick={() => deleteUser(user.id, `${user.nombre} ${user.apellido}`)}
                              className="flex items-center gap-1 rounded border border-red-200 px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 size={13} />
                            </button>
                          ) : null}
                        </div>
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
            <p className="text-xs text-stone-400">{meta.total} usuarios</p>
            <div className="flex items-center gap-2 self-end sm:self-auto">
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
        ) : null}
      </div>

      {(selectedUser || detailLoading) ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setSelectedUser(null)} className="absolute right-4 top-4 cursor-pointer text-stone-400 hover:text-stone-600">
              <X size={18} />
            </button>

            {detailLoading ? (
              <div className="py-20 text-center">
                <Loader2 size={28} className="mx-auto animate-spin text-wine" />
              </div>
            ) : selectedUser ? (
              <div className="p-6 sm:p-7">
                <h3 className="mb-1 text-xl font-semibold text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                  {selectedUser.nombre} {selectedUser.apellido}
                </h3>
                <p className="mb-6 break-all text-sm text-stone-400">{selectedUser.email}</p>

                <div className="mb-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-stone-400">Tier</span>
                    <div className="mt-1"><UserTierBadge tier={selectedUser.tier} /></div>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-stone-400">Rol</span>
                    <div className="mt-1"><UserRoleBadge role={selectedUser.role} /></div>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-stone-400">Compras</span>
                    <span className="mt-1 block font-medium text-stone-700">{formatCOP(selectedUser.totalComprasAcumulado)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-stone-400">Empresa</span>
                    <span className="mt-1 block text-stone-600">{selectedUser.empresa || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-stone-400">Ciudad</span>
                    <span className="mt-1 block text-stone-600">{selectedUser.ciudad || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-stone-400">Estado</span>
                    <span className={`mt-1 inline-block rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${selectedUser.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {selectedUser.isActive ? 'Activo' : 'Eliminado'}
                    </span>
                  </div>
                </div>

                {selectedUser.orders?.length > 0 ? (
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-700">
                      <ShoppingBag size={14} />
                      Últimos pedidos
                    </h4>
                    <div className="space-y-2">
                      {selectedUser.orders.map((order) => (
                        <div key={order.id} className="flex flex-col gap-2 rounded-xl bg-ivory px-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                          <span className="font-medium text-stone-700">{order.orderNumber}</span>
                          <span className="text-stone-500">{formatCOP(order.total)}</span>
                          <span className="text-stone-400">{new Date(order.createdAt).toLocaleDateString('es-CO')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!confirmTier}
        title="Cambiar tier"
        message={`¿Cambiar el tier de ${confirmTier?.nombre ?? 'este usuario'} a ${confirmTier ? TIER_LABELS[confirmTier.tier] : ''}?`}
        confirmLabel="Cambiar"
        onConfirm={confirmTierChange}
        onCancel={() => setConfirmTier(null)}
      />

      <ConfirmDialog
        open={!!confirmRole}
        title="Cambiar rol"
        message={`¿Cambiar el rol de ${confirmRole?.nombre ?? 'este usuario'} a ${confirmRole ? ROLE_LABELS[confirmRole.role] : ''}?${confirmRole?.role === 'admin' ? ' Tendrá acceso completo al panel administrativo.' : ''}`}
        confirmLabel="Cambiar rol"
        danger={confirmRole?.role === 'admin'}
        onConfirm={confirmRoleChange}
        onCancel={() => setConfirmRole(null)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar usuario"
        message={`¿Seguro que quieres eliminar a ${confirmDelete?.nombre ?? 'este usuario'}? No podrá iniciar sesión, pero su historial de pedidos se conserva.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={confirmDeleteUser}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
