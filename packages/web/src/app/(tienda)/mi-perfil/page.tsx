'use client';

import { useState } from 'react';
import Link from 'next/link';
import { m, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Edit3,
  Package,
  ArrowRight,
  Lock,
  CheckCircle,
  Star,
  Sparkles,
  Loader2,
  X,
  Save,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ColombiaLocationFields } from '@/components/shared/ColombiaLocationFields';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/context/ToastProvider';
import { formatCOP } from '@/lib/api-client';

const HITOS_MAYORISTA = [
  { id: 1, nombre: 'Primer pedido mayorista', meta: 500000, premio: 'Envío gratis en tu próximo pedido', icon: Package },
  { id: 2, nombre: 'Comprador frecuente', meta: 2500000, premio: 'Kit de muestras premium (5 piezas)', icon: Star },
  { id: 3, nombre: 'Aliado estratégico', meta: 8000000, premio: 'Sesión fotográfica de catálogo profesional', icon: Sparkles },
];

const HITOS_GRANMAYOR = [
  { id: 1, nombre: 'Gran mayorista activo', meta: 5000000, premio: 'Envío prioritario permanente', icon: Package },
  { id: 2, nombre: 'Distribuidor elite', meta: 15000000, premio: 'Catálogo exclusivo + material POP personalizado', icon: Star },
  { id: 3, nombre: "Socio VIP D'orella", meta: 35000000, premio: 'Experiencia premium: cena + showroom privado', icon: Sparkles },
  { id: 4, nombre: 'Embajador de marca', meta: 60000000, premio: 'Viaje de reconocimiento + colección exclusiva', icon: Star },
];

const MOCK_COMPRAS: Record<string, number> = {
  mayorista: 3200000,
  granmayorista: 22000000,
};

const reveal = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

function stagger(index: number) {
  return {
    ...reveal,
    transition: {
      ...reveal.transition,
      delay: index * 0.08,
    },
  };
}

export default function MiPerfilPage() {
  const { user, tier, tierInfo, updateProfile, changePassword } = useAuth();
  const { showToast } = useToast();
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    passwordActual: '',
    passwordNueva: '',
    confirmar: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  if (!user) return null;

  const isMayorista = tier === 'mayorista' || tier === 'granmayorista';
  const isGranMayor = tier === 'granmayorista';
  const compras = MOCK_COMPRAS[tier] || 0;
  const hitos = isGranMayor ? HITOS_GRANMAYOR : HITOS_MAYORISTA;
  const isEmailProvider = !user.provider || user.provider === 'email';
  const isEditing = editingSection === 'datos';

  const tierBadgeClass = isGranMayor
    ? 'border-gold/20 bg-gold/10 text-gold'
    : tier === 'mayorista'
      ? 'border-wine/20 bg-wine/10 text-wine'
      : 'border-stone-200 bg-stone-100 text-stone-500';

  const basicFields = [
    { label: 'Nombre completo', key: 'nombre', value: user.nombre, icon: User, type: 'text' },
    { label: 'Email', key: 'email', value: user.email || '-', icon: Mail, type: 'email' },
    { label: 'Teléfono', key: 'telefono', value: user.telefono || '-', icon: Phone, type: 'text' },
  ] as const;

  function startEditing() {
    if (!user) return;

    setEditForm({
      nombre: user.nombre || '',
      email: user.email || '',
      telefono: user.telefono || '',
      departamento: user.departamento || '',
      ciudad: user.ciudad || '',
      direccion: user.direccion || '',
    });
    setEditingSection('datos');
  }

  async function saveProfileHandler() {
    setSaving(true);

    try {
      await updateProfile(editForm);
      showToast('Perfil actualizado');
      setEditingSection(null);
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(event: React.FormEvent) {
    event.preventDefault();

    if (passwordForm.passwordNueva !== passwordForm.confirmar) {
      showToast('Las contraseñas no coinciden', 'error');
      return;
    }

    if (passwordForm.passwordNueva.length < 8) {
      showToast('Mínimo 8 caracteres', 'error');
      return;
    }

    setSavingPassword(true);

    try {
      await changePassword({
        passwordActual: passwordForm.passwordActual,
        passwordNueva: passwordForm.passwordNueva,
      });
      showToast('Contraseña actualizada');
      setPasswordForm({ passwordActual: '', passwordNueva: '', confirmar: '' });
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="min-h-screen flex-1 bg-white">
      <div className="mx-auto max-w-[900px] px-6 py-10">
        <m.div {...reveal} className="mb-12 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-wine">
            <span className="text-2xl font-medium text-white" style={{ fontFamily: 'var(--font-serif)' }}>
              {user.nombre?.charAt(0)?.toUpperCase()}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl text-stone-800 sm:text-4xl" style={{ fontFamily: 'var(--font-serif)' }}>
                {user.nombre}
              </h1>
              <span className={`rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${tierBadgeClass}`}>
                {tierInfo.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-light text-stone-400">
              {user.email && (
                <span className="flex items-center gap-1.5">
                  <Mail size={13} /> {user.email}
                </span>
              )}
              {user.telefono && (
                <span className="flex items-center gap-1.5">
                  <Phone size={13} /> {user.telefono}
                </span>
              )}
              {(user.ciudad || user.departamento) && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} /> {[user.ciudad, user.departamento].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </div>

          {!isEditing && (
            <button
              onClick={startEditing}
              className="flex flex-shrink-0 cursor-pointer items-center gap-2 border border-stone-200 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] text-stone-500 transition-all hover:border-stone-400 hover:text-stone-700"
            >
              <Edit3 size={13} />
              Editar perfil
            </button>
          )}
        </m.div>

        <m.section {...stagger(0)} className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
              Mis datos
            </h2>
            {!isEditing && (
              <button
                onClick={startEditing}
                className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-wine/50 transition-colors hover:text-wine"
              >
                <Edit3 size={12} />
                Editar
              </button>
            )}
          </div>

          <div className="rounded-lg border border-stone-200 p-6 sm:p-8">
            <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
              {basicFields.map((field) => (
                <div key={field.key}>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-stone-400">
                    <field.icon size={11} className="text-stone-300" />
                    {field.label}
                  </p>
                  {isEditing ? (
                    <input
                      type={field.type}
                      value={editForm[field.key] || ''}
                      onChange={(event) => setEditForm({ ...editForm, [field.key]: event.target.value })}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[15px] text-stone-700 transition-all focus:border-wine/30 focus:outline-none focus:ring-1 focus:ring-wine/10"
                    />
                  ) : (
                    <p className="text-[15px] text-stone-700">{field.value}</p>
                  )}
                </div>
              ))}

              {isEditing ? (
                <ColombiaLocationFields
                  department={editForm.departamento || ''}
                  city={editForm.ciudad || ''}
                  onDepartmentChange={(value) => setEditForm({ ...editForm, departamento: value })}
                  onCityChange={(value) => setEditForm({ ...editForm, ciudad: value })}
                />
              ) : (
                <>
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-stone-400">
                      <MapPin size={11} className="text-stone-300" />
                      Departamento
                    </p>
                    <p className="text-[15px] text-stone-700">{user.departamento || '-'}</p>
                  </div>
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-stone-400">
                      <MapPin size={11} className="text-stone-300" />
                      Ciudad
                    </p>
                    <p className="text-[15px] text-stone-700">{user.ciudad || '-'}</p>
                  </div>
                </>
              )}

              <div className="sm:col-span-2">
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-stone-400">
                  <MapPin size={11} className="text-stone-300" />
                  Dirección de despacho
                </p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.direccion || ''}
                    onChange={(event) => setEditForm({ ...editForm, direccion: event.target.value })}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[15px] text-stone-700 transition-all focus:border-wine/30 focus:outline-none focus:ring-1 focus:ring-wine/10"
                  />
                ) : (
                  <p className="text-[15px] text-stone-700">{user.direccion || '-'}</p>
                )}
              </div>
            </div>

            {isEditing ? (
              <div className="mt-6 flex items-center gap-3 border-t border-stone-100 pt-4">
                <button
                  onClick={saveProfileHandler}
                  disabled={saving}
                  className="flex cursor-pointer items-center gap-2 bg-wine px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] text-white transition-colors hover:bg-wine-light disabled:opacity-40"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button
                  onClick={() => setEditingSection(null)}
                  className="flex cursor-pointer items-center gap-2 border border-stone-200 px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] text-stone-500 transition-colors hover:border-stone-400"
                >
                  <X size={13} />
                  Cancelar
                </button>
              </div>
            ) : (
              <p className="mt-6 text-[10px] font-light italic text-stone-300">
                Haz clic en &quot;Editar&quot; para actualizar tus datos de contacto y despacho.
              </p>
            )}
          </div>
        </m.section>

        {isEmailProvider && (
          <m.section {...stagger(1)} className="mb-12">
            <div className="mb-6 flex items-center gap-2">
              <Shield size={18} className="text-wine/40" />
              <h2 className="text-[clamp(1.5rem,3vw,2rem)] text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
                Seguridad
              </h2>
            </div>

            <div className="rounded-lg border border-stone-200 p-6 sm:p-8">
              <h3 className="mb-4 text-sm font-semibold text-stone-700">Cambiar contraseña</h3>
              <form onSubmit={handleChangePassword} className="max-w-sm space-y-4">
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-stone-400">
                    Contraseña actual
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordForm.passwordActual}
                      onChange={(event) => setPasswordForm({ ...passwordForm, passwordActual: event.target.value })}
                      required
                      className="w-full rounded-lg border border-stone-200 px-3 py-2.5 pr-10 text-sm transition-all focus:border-wine/30 focus:outline-none focus:ring-1 focus:ring-wine/10"
                    />
                    <button
                      type="button"
                      aria-label={showCurrentPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      onClick={() => setShowCurrentPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-stone-400 transition-colors hover:text-wine"
                    >
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-stone-400">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordForm.passwordNueva}
                      onChange={(event) => setPasswordForm({ ...passwordForm, passwordNueva: event.target.value })}
                      placeholder="Mínimo 8 caracteres"
                      required
                      className="w-full rounded-lg border border-stone-200 px-3 py-2.5 pr-10 text-sm transition-all focus:border-wine/30 focus:outline-none focus:ring-1 focus:ring-wine/10"
                    />
                    <button
                      type="button"
                      aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      onClick={() => setShowNewPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-stone-400 transition-colors hover:text-wine"
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-stone-400">
                    Confirmar
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordForm.confirmar}
                      onChange={(event) => setPasswordForm({ ...passwordForm, confirmar: event.target.value })}
                      required
                      className="w-full rounded-lg border border-stone-200 px-3 py-2.5 pr-10 text-sm transition-all focus:border-wine/30 focus:outline-none focus:ring-1 focus:ring-wine/10"
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      onClick={() => setShowConfirmPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-stone-400 transition-colors hover:text-wine"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="flex cursor-pointer items-center gap-2 bg-wine px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] text-white transition-colors hover:bg-wine-light disabled:opacity-40"
                >
                  {savingPassword ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                  {savingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
                </button>
              </form>
            </div>
          </m.section>
        )}

        <m.section {...stagger(isEmailProvider ? 2 : 1)} className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
              Mis pedidos
            </h2>
            <Link
              href="/mis-pedidos"
              className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-wine/50 transition-colors hover:text-wine"
            >
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>

          <Link
            href="/mis-pedidos"
            className="group block cursor-pointer rounded-lg border border-stone-200 p-6 transition-colors hover:border-stone-300 sm:p-8"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-wine/5">
                <Package size={22} className="text-wine/40 transition-colors group-hover:text-wine" />
              </div>
              <div>
                <p className="text-[15px] font-medium text-stone-700 transition-colors group-hover:text-wine">
                  Historial de pedidos y seguimiento
                </p>
                <p className="mt-0.5 text-[13px] font-light text-stone-400">Revisa el estado de tus órdenes</p>
              </div>
              <ArrowRight size={16} className="ml-auto hidden text-stone-300 transition-colors group-hover:text-wine sm:block" />
            </div>
          </Link>
        </m.section>

        <AnimatePresence>
          {isMayorista && (
            <m.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-12 overflow-hidden"
            >
              <div className="mb-6 flex items-center gap-3">
                <h2 className="text-[clamp(1.5rem,3vw,2rem)] text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
                  Mi progreso
                </h2>
                {isGranMayor && (
                  <span className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-gold">
                    VIP
                  </span>
                )}
              </div>

              <div className="mb-6 rounded-lg border border-stone-200 p-6 sm:p-8">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-stone-400">Compras este trimestre</p>
                <p
                  className="mb-5 text-[2.2rem] text-stone-800"
                  style={{ fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}
                >
                  {formatCOP(compras)}
                </p>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <m.div
                    initial={{ width: 0 }}
                    animate={{ width: `${getProgress(compras, hitos)}%` }}
                    transition={{ duration: 1.2 }}
                    className="h-full rounded-full"
                    style={{
                      background: isGranMayor
                        ? 'linear-gradient(90deg, #C9A84C, #D4BA6A)'
                        : 'linear-gradient(90deg, #5B0E16, #7A1A24)',
                    }}
                  />
                </div>
              </div>

              <div className="space-y-0">
                {hitos.map((hito, index) => {
                  const unlocked = compras >= hito.meta;
                  const isNext = !unlocked && (index === 0 || compras >= hitos[index - 1].meta);

                  return (
                    <div key={hito.id} className="group border-b border-stone-100 last:border-b-0">
                      <div className="flex items-start gap-5 py-7">
                        <div className="flex flex-shrink-0 flex-col items-center gap-2 pt-1">
                          <span className={`h-10 w-px ${unlocked ? 'bg-gold' : isNext ? 'bg-wine/30' : 'bg-stone-200'}`} />
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full ${
                              unlocked
                                ? 'bg-gold/10 ring-1 ring-gold/30'
                                : isNext
                                  ? 'bg-wine/5 ring-1 ring-wine/15'
                                  : 'bg-stone-50 ring-1 ring-stone-200'
                            }`}
                          >
                            {unlocked ? (
                              <CheckCircle size={14} className="text-gold" />
                            ) : !isNext ? (
                              <Lock size={11} className="text-stone-300" />
                            ) : (
                              <hito.icon size={13} className="text-wine/70" />
                            )}
                          </span>
                        </div>

                        <div className="flex-1">
                          <div className="mb-1.5 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                            <h4
                              className={`text-[1.1rem] ${
                                unlocked ? 'text-stone-800' : isNext ? 'text-stone-800' : 'text-stone-400'
                              }`}
                              style={{ fontFamily: 'var(--font-serif)' }}
                            >
                              {hito.nombre}
                            </h4>
                            <span className="font-functional text-[10px] uppercase tracking-[0.15em] text-stone-300">
                              {formatCOP(hito.meta)}
                            </span>
                          </div>
                          <p className={`text-[13px] font-light ${unlocked ? 'text-stone-500' : 'text-stone-400'}`}>
                            {hito.premio}
                          </p>
                          {unlocked && (
                            <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
                              <span className="h-px w-4 bg-gold/50" />
                              Desbloqueado
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </m.section>
          )}
        </AnimatePresence>

        {!isMayorista && (
          <m.section {...reveal} className="mb-12 rounded-lg border border-gold/20 bg-gold/[0.02] p-8 text-center sm:p-10">
            <Sparkles size={24} className="mx-auto mb-4 text-gold" />
            <p className="mb-2 text-xl text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
              Desbloquea herramientas exclusivas
            </p>
            <p className="mx-auto mb-6 max-w-md text-sm font-light text-stone-400">
              Al alcanzar el nivel Mayorista accedes a recompensas, catálogos personalizados y descuentos de hasta 37.5%.
            </p>
            <Link
              href="/catalogo"
              className="inline-flex cursor-pointer items-center gap-2 bg-wine px-8 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-white transition-colors hover:bg-wine-light"
            >
              Explorar catálogo <ArrowRight size={14} />
            </Link>
          </m.section>
        )}
      </div>
    </div>
  );
}

function getProgress(compras: number, hitos: Array<{ meta: number }>) {
  const next = hitos.find((hito) => compras < hito.meta);
  const nextMeta = next ? next.meta : hitos[hitos.length - 1].meta;
  const prevIndex = hitos.findIndex((hito) => hito.meta === nextMeta) - 1;
  const prevMeta = prevIndex >= 0 ? hitos[prevIndex].meta : 0;

  if (nextMeta === prevMeta) return 100;

  return Math.min(100, ((compras - prevMeta) / (nextMeta - prevMeta)) * 100);
}
