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
  por_mayor: 'bg-gold/10 text-gold-dark border border-gold/20',
  gran_mayor: 'bg-wine/10 text-wine border border-wine/20',
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

interface PendingVerification {
  verificationId: string;
  userId: string;
  nombre: string;
  changeType: 'tier' | 'role';
  requestedValue: string;
  expiresAt: string;
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
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [requestingVerification, setRequestingVerification] = useState(false);
  const [verifyingChange, setVerifyingChange] = useState(false);

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
      setRequestingVerification(true);
      const res = await request('POST', `/api/admin/users/${confirmTier.userId}/request-change-verification`, {
        changeType: 'tier',
        requestedValue: confirmTier.tier,
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'No se pudo solicitar la verificación');
      }

      setPendingVerification({
        verificationId: res.data.verificationId,
        userId: confirmTier.userId,
        nombre: confirmTier.nombre,
        changeType: 'tier',
        requestedValue: confirmTier.tier,
        expiresAt: res.data.expiresAt,
      });
      setVerificationCode('');
      showToast('Código enviado al correo aprobador');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setRequestingVerification(false);
      setConfirmTier(null);
    }
  }

  function changeRole(userId: string, nombre: string, newRole: string) {
    setConfirmRole({ userId, nombre, role: newRole });
  }

  async function confirmRoleChange() {
    if (!confirmRole) return;

    try {
      setRequestingVerification(true);
      const res = await request('POST', `/api/admin/users/${confirmRole.userId}/request-change-verification`, {
        changeType: 'role',
        requestedValue: confirmRole.role,
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'No se pudo solicitar la verificación');
      }

      setPendingVerification({
        verificationId: res.data.verificationId,
        userId: confirmRole.userId,
        nombre: confirmRole.nombre,
        changeType: 'role',
        requestedValue: confirmRole.role,
        expiresAt: res.data.expiresAt,
      });
      setVerificationCode('');
      showToast('Código enviado al correo aprobador');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setRequestingVerification(false);
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

  async function confirmSensitiveChange() {
    if (!pendingVerification) return;

    try {
      setVerifyingChange(true);
      const res = await request('POST', `/api/admin/users/${pendingVerification.userId}/confirm-change-verification`, {
        verificationId: pendingVerification.verificationId,
        code: verificationCode.trim(),
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'No se pudo verificar el cambio');
      }

      showToast(pendingVerification.changeType === 'tier' ? 'Tier actualizado' : 'Rol actualizado');
      loadUsers();
      if (selectedUser?.id === pendingVerification.userId) openDetail(pendingVerification.userId);
      setPendingVerification(null);
      setVerificationCode('');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setVerifyingChange(false);
    }
  }

  function closeVerificationModal() {
    if (verifyingChange) return;
    setPendingVerification(null);
    setVerificationCode('');
  }

  const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 1;

  return (
    <div>
      <h1 className="mb-1 text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Usuarios</h1>
      <p className="mb-8 text-sm text-stone-400">Gestión de clientes y tiers</p>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-stone-200 bg-white py-2.5 pl-11 pr-4 text-sm focus:border-stone-300 focus:outline-none"
          />
        </form>
        <select
          value={tierFilter}
          onChange={(e) => {
            setTierFilter(e.target.value);
            setPage(1);
          }}
          className="cursor-pointer rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-600 focus:outline-none"
        >
          <option value="">Todos los tiers</option>
          {TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {TIER_LABELS[tier]}
            </option>
          ))}
        </select>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
                      {!user.isActive && (
                        <span className="ml-2 text-[9px] font-semibold uppercase tracking-wider text-stone-400">
                          (Eliminado)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-stone-500">
                      {user.email}
                      {currentUser?.email === user.email && <ShieldCheck size={13} className="ml-1.5 inline text-wine" />}
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
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${user.role === 'admin' ? 'bg-wine/10 text-wine' : 'bg-stone-100 text-stone-500'}`}>
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
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
                        {user.isActive && user.id !== currentUser?.id && (
                          <button
                            onClick={() => deleteUser(user.id, `${user.nombre} ${user.apellido}`)}
                            className="flex items-center gap-1 rounded border border-red-200 px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
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
            <p className="text-xs text-stone-400">{meta.total} usuarios</p>
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

      {(selectedUser || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl"
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
              <div className="p-6">
                <h3 className="mb-1 text-xl font-semibold text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                  {selectedUser.nombre} {selectedUser.apellido}
                </h3>
                <p className="mb-6 text-sm text-stone-400">{selectedUser.email}</p>

                <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-stone-400">Tier</span>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TIER_COLORS[selectedUser.tier] || ''}`}>
                      {TIER_LABELS[selectedUser.tier]}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-stone-400">Rol</span>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${selectedUser.role === 'admin' ? 'bg-wine/10 text-wine' : 'bg-stone-100 text-stone-500'}`}>
                      {ROLE_LABELS[selectedUser.role] || selectedUser.role}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-stone-400">Compras</span>
                    <span className="font-medium text-stone-700">{formatCOP(selectedUser.totalComprasAcumulado)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-stone-400">Empresa</span>
                    <span className="text-stone-600">{selectedUser.empresa || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-stone-400">Ciudad</span>
                    <span className="text-stone-600">{selectedUser.ciudad || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-stone-400">Estado</span>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${selectedUser.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {selectedUser.isActive ? 'Activo' : 'Eliminado'}
                    </span>
                  </div>
                </div>

                {selectedUser.orders?.length > 0 && (
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-700">
                      <ShoppingBag size={14} />
                      Últimos pedidos
                    </h4>
                    <div className="space-y-2">
                      {selectedUser.orders.map((order) => (
                        <div key={order.id} className="flex items-center justify-between rounded bg-ivory px-3 py-2 text-xs">
                          <span className="font-medium text-stone-700">{order.orderNumber}</span>
                          <span className="text-stone-500">{formatCOP(order.total)}</span>
                          <span className="text-stone-400">{new Date(order.createdAt).toLocaleDateString('es-CO')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmTier}
        title="Cambiar tier"
        message={`¿Solicitar verificación para cambiar el tier de ${confirmTier?.nombre ?? 'este usuario'} a ${confirmTier ? TIER_LABELS[confirmTier.tier] : ''}?`}
        confirmLabel={requestingVerification ? 'Enviando...' : 'Solicitar código'}
        onConfirm={confirmTierChange}
        onCancel={() => setConfirmTier(null)}
      />

      <ConfirmDialog
        open={!!confirmRole}
        title="Cambiar rol"
        message={`¿Solicitar verificación para cambiar el rol de ${confirmRole?.nombre ?? 'este usuario'} a ${confirmRole ? ROLE_LABELS[confirmRole.role] : ''}?${confirmRole?.role === 'admin' ? ' Tendrá acceso completo al panel administrativo.' : ''}`}
        confirmLabel={requestingVerification ? 'Enviando...' : 'Solicitar código'}
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

      {pendingVerification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closeVerificationModal}>
          <div className="absolute inset-0 bg-black/45" />
          <div
            className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
              Verificación requerida
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              Enviamos un código de 6 dígitos al correo autorizado para aprobar este cambio. Ingrésalo para aplicar el cambio de {pendingVerification.changeType === 'tier' ? 'tier' : 'rol'} a {pendingVerification.nombre}.
            </p>

            <div className="mt-4 rounded-2xl border border-wine/10 bg-ivory/70 px-4 py-3 text-sm text-stone-600">
              <p>
                <span className="font-medium text-stone-800">Nuevo valor:</span>{' '}
                {pendingVerification.changeType === 'tier'
                  ? TIER_LABELS[pendingVerification.requestedValue]
                  : ROLE_LABELS[pendingVerification.requestedValue]}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Este código vence el {new Date(pendingVerification.expiresAt).toLocaleString('es-CO')}.
              </p>
            </div>

            <label className="mt-5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
              Código de verificación
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 text-center text-xl tracking-[0.35em] text-stone-800 focus:border-wine focus:outline-none"
            />

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeVerificationModal}
                className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-600 transition-colors hover:bg-stone-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={verificationCode.trim().length !== 6 || verifyingChange}
                onClick={confirmSensitiveChange}
                className="inline-flex items-center justify-center rounded-xl bg-wine px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-wine-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifyingChange ? <Loader2 size={16} className="animate-spin" /> : 'Verificar y aplicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
