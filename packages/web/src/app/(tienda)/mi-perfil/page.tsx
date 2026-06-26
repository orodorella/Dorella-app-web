'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Phone, MapPin, Edit3, Package, ArrowRight, Lock, CheckCircle, Star, Sparkles, Loader2, X, Save, Shield } from 'lucide-react';
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
  { id: 2, nombre: 'Distribuidor élite', meta: 15000000, premio: 'Catálogo exclusivo + material POP personalizado', icon: Star },
  { id: 3, nombre: 'Socio VIP D\'orella', meta: 35000000, premio: 'Experiencia premium: cena + showroom privado', icon: Sparkles },
  { id: 4, nombre: 'Embajador de marca', meta: 60000000, premio: 'Viaje de reconocimiento + colección exclusiva', icon: Star },
];
const MOCK_COMPRAS: Record<string, number> = { mayorista: 3200000, granmayorista: 22000000 };

const reveal = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } };
function stagger(i: number) { return { ...reveal, transition: { ...reveal.transition, delay: i * 0.08 } }; }

export default function MiPerfilPage() {
  const { user, tier, tierInfo, updateProfile, changePassword } = useAuth();
  const { showToast } = useToast();
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ passwordActual: '', passwordNueva: '', confirmar: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  if (!user) return null;

  const isMayorista = tier === 'mayorista' || tier === 'granmayorista';
  const isGranMayor = tier === 'granmayorista';
  const compras = MOCK_COMPRAS[tier] || 0;
  const hitos = isGranMayor ? HITOS_GRANMAYOR : HITOS_MAYORISTA;
  const isEmailProvider = !user.provider || user.provider === 'email';
  const isEditing = editingSection === 'datos';

  const tierBadgeClass = isGranMayor ? 'bg-gold/10 text-gold border-gold/20' : tier === 'mayorista' ? 'bg-wine/10 text-wine border-wine/20' : 'bg-stone-100 text-stone-500 border-stone-200';

  function startEditing() {
    if (!user) return;
    setEditForm({ nombre: user.nombre || '', email: user.email || '', telefono: user.telefono || '', ciudad: user.ciudad || '', direccion: user.direccion || '' });
    setEditingSection('datos');
  }

  async function saveProfileHandler() {
    setSaving(true);
    try { await updateProfile(editForm); showToast('Perfil actualizado'); setEditingSection(null); }
    catch (e) { showToast((e as Error).message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwordForm.passwordNueva !== passwordForm.confirmar) { showToast('Las contraseñas no coinciden', 'error'); return; }
    if (passwordForm.passwordNueva.length < 8) { showToast('Mínimo 8 caracteres', 'error'); return; }
    setSavingPassword(true);
    try { await changePassword({ passwordActual: passwordForm.passwordActual, passwordNueva: passwordForm.passwordNueva }); showToast('Contraseña actualizada'); setPasswordForm({ passwordActual: '', passwordNueva: '', confirmar: '' }); }
    catch (e) { showToast((e as Error).message, 'error'); }
    finally { setSavingPassword(false); }
  }

  const fields = [
    { label: 'Nombre completo', key: 'nombre', value: user.nombre, icon: User },
    { label: 'Email', key: 'email', value: user.email || '—', icon: Mail },
    { label: 'Teléfono', key: 'telefono', value: user.telefono || '—', icon: Phone },
    { label: 'Dirección de despacho', key: 'direccion', value: user.direccion || '—', icon: MapPin },
    { label: 'Ciudad', key: 'ciudad', value: user.ciudad || '—', icon: MapPin },
  ];

  return (
    <div className="flex-1 bg-white min-h-screen">
      <div className="max-w-[900px] mx-auto px-6 py-10">
        {/* Header */}
        <motion.div {...reveal} className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-12">
          <div className="w-20 h-20 rounded-full bg-wine flex items-center justify-center flex-shrink-0">
            <span className="text-white text-2xl font-medium" style={{ fontFamily: 'var(--font-serif)' }}>{user.nombre?.charAt(0)?.toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-3xl sm:text-4xl text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>{user.nombre}</h1>
              <span className={`text-[9px] font-semibold uppercase tracking-[0.12em] px-3 py-1 rounded-full border ${tierBadgeClass}`}>{tierInfo.label}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-stone-400 font-light">
              {user.email && <span className="flex items-center gap-1.5"><Mail size={13} /> {user.email}</span>}
              {user.telefono && <span className="flex items-center gap-1.5"><Phone size={13} /> {user.telefono}</span>}
              {user.ciudad && <span className="flex items-center gap-1.5"><MapPin size={13} /> {user.ciudad}</span>}
            </div>
          </div>
          {!isEditing && <button onClick={startEditing} className="flex items-center gap-2 border border-stone-200 text-stone-500 px-5 py-2.5 text-[11px] tracking-[0.1em] uppercase hover:border-stone-400 hover:text-stone-700 transition-all cursor-pointer font-medium flex-shrink-0"><Edit3 size={13} /> Editar perfil</button>}
        </motion.div>

        {/* Datos */}
        <motion.section {...stagger(0)} className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>Mis datos</h2>
            {!isEditing && <button onClick={startEditing} className="text-[11px] text-wine/50 hover:text-wine uppercase tracking-[0.1em] font-medium cursor-pointer transition-colors flex items-center gap-1.5"><Edit3 size={12} /> Editar</button>}
          </div>
          <div className="border border-stone-200 rounded-lg p-6 sm:p-8">
            <div className="grid sm:grid-cols-2 gap-x-10 gap-y-6">
              {fields.map((f) => (
                <div key={f.label}>
                  <p className="text-[10px] text-stone-400 uppercase tracking-[0.18em] font-medium mb-1.5 flex items-center gap-1.5"><f.icon size={11} className="text-stone-300" />{f.label}</p>
                  {isEditing ? <input type={f.key === 'email' ? 'email' : 'text'} value={editForm[f.key] || ''} onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-[15px] text-stone-700 focus:outline-none focus:border-wine/30 focus:ring-1 focus:ring-wine/10 transition-all" />
                  : <p className="text-[15px] text-stone-700">{f.value}</p>}
                </div>
              ))}
            </div>
            {isEditing ? (
              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-stone-100">
                <button onClick={saveProfileHandler} disabled={saving} className="flex items-center gap-2 bg-wine text-white px-6 py-2.5 text-[11px] tracking-[0.1em] uppercase font-medium cursor-pointer hover:bg-wine-light transition-colors disabled:opacity-40">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}{saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button onClick={() => setEditingSection(null)} className="flex items-center gap-2 border border-stone-200 text-stone-500 px-6 py-2.5 text-[11px] tracking-[0.1em] uppercase font-medium cursor-pointer hover:border-stone-400 transition-colors"><X size={13} /> Cancelar</button>
              </div>
            ) : <p className="text-[10px] text-stone-300 mt-6 italic font-light">Hacé clic en &quot;Editar&quot; para actualizar tus datos</p>}
          </div>
        </motion.section>

        {/* Seguridad */}
        {isEmailProvider && (
          <motion.section {...stagger(1)} className="mb-12">
            <div className="flex items-center gap-2 mb-6"><Shield size={18} className="text-wine/40" /><h2 className="text-[clamp(1.5rem,3vw,2rem)] text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>Seguridad</h2></div>
            <div className="border border-stone-200 rounded-lg p-6 sm:p-8">
              <h3 className="text-sm font-semibold text-stone-700 mb-4">Cambiar contraseña</h3>
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
                <div><label className="block text-[10px] text-stone-400 uppercase tracking-[0.15em] mb-1">Contraseña actual</label><input type="password" value={passwordForm.passwordActual} onChange={(e) => setPasswordForm({ ...passwordForm, passwordActual: e.target.value })} required className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-wine/30 focus:ring-1 focus:ring-wine/10 transition-all" /></div>
                <div><label className="block text-[10px] text-stone-400 uppercase tracking-[0.15em] mb-1">Nueva contraseña</label><input type="password" value={passwordForm.passwordNueva} onChange={(e) => setPasswordForm({ ...passwordForm, passwordNueva: e.target.value })} placeholder="Mínimo 8 caracteres" required className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-wine/30 focus:ring-1 focus:ring-wine/10 transition-all" /></div>
                <div><label className="block text-[10px] text-stone-400 uppercase tracking-[0.15em] mb-1">Confirmar</label><input type="password" value={passwordForm.confirmar} onChange={(e) => setPasswordForm({ ...passwordForm, confirmar: e.target.value })} required className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-wine/30 focus:ring-1 focus:ring-wine/10 transition-all" /></div>
                <button type="submit" disabled={savingPassword} className="flex items-center gap-2 bg-wine text-white px-6 py-2.5 text-[11px] tracking-[0.1em] uppercase font-medium cursor-pointer hover:bg-wine-light transition-colors disabled:opacity-40">
                  {savingPassword ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}{savingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
                </button>
              </form>
            </div>
          </motion.section>
        )}

        {/* Pedidos */}
        <motion.section {...stagger(isEmailProvider ? 2 : 1)} className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>Mis pedidos</h2>
            <Link href="/mis-pedidos" className="text-[11px] text-wine/50 hover:text-wine uppercase tracking-[0.1em] font-medium cursor-pointer transition-colors flex items-center gap-1.5">Ver todos <ArrowRight size={12} /></Link>
          </div>
          <Link href="/mis-pedidos" className="block border border-stone-200 rounded-lg p-6 sm:p-8 hover:border-stone-300 transition-colors group cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-wine/5 flex items-center justify-center flex-shrink-0"><Package size={22} className="text-wine/40 group-hover:text-wine transition-colors" /></div>
              <div><p className="text-[15px] text-stone-700 font-medium group-hover:text-wine transition-colors">Historial de pedidos y seguimiento</p><p className="text-[13px] text-stone-400 font-light mt-0.5">Revisa el estado de tus órdenes</p></div>
              <ArrowRight size={16} className="text-stone-300 group-hover:text-wine ml-auto hidden sm:block transition-colors" />
            </div>
          </Link>
        </motion.section>

        {/* Progreso (mayoristas) */}
        <AnimatePresence>
          {isMayorista && (
            <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-12 overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-[clamp(1.5rem,3vw,2rem)] text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>Mi progreso</h2>
                {isGranMayor && <span className="text-[9px] font-semibold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full bg-gold/10 text-gold border border-gold/20">VIP</span>}
              </div>
              <div className="border border-stone-200 rounded-lg p-6 sm:p-8 mb-6">
                <p className="text-[10px] text-stone-400 uppercase tracking-[0.2em] font-medium mb-3">Compras este trimestre</p>
                <p className="text-[2.2rem] text-stone-800 mb-5" style={{ fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>{formatCOP(compras)}</p>
                <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${getProgress(compras, hitos)}%` }} transition={{ duration: 1.2 }}
                    className="h-full rounded-full" style={{ background: isGranMayor ? 'linear-gradient(90deg, #C9A84C, #D4BA6A)' : 'linear-gradient(90deg, #5B0E16, #7A1A24)' }} />
                </div>
              </div>
              <div className="space-y-0">
                {hitos.map((hito, i) => {
                  const unlocked = compras >= hito.meta;
                  const isNext = !unlocked && (i === 0 || compras >= hitos[i - 1].meta);
                  return (
                    <div key={hito.id} className="group border-b border-stone-100 last:border-b-0">
                      <div className="flex items-start gap-5 py-7">
                        <div className="flex flex-col items-center gap-2 flex-shrink-0 pt-1">
                          <span className={`w-px h-10 ${unlocked ? 'bg-gold' : isNext ? 'bg-wine/30' : 'bg-stone-200'}`} />
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center ${unlocked ? 'bg-gold/10 ring-1 ring-gold/30' : isNext ? 'bg-wine/5 ring-1 ring-wine/15' : 'bg-stone-50 ring-1 ring-stone-200'}`}>
                            {unlocked ? <CheckCircle size={14} className="text-gold" /> : !isNext ? <Lock size={11} className="text-stone-300" /> : <hito.icon size={13} className="text-wine/70" />}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-1.5">
                            <h4 className={`text-[1.1rem] ${unlocked ? 'text-stone-800' : isNext ? 'text-stone-800' : 'text-stone-400'}`} style={{ fontFamily: 'var(--font-serif)' }}>{hito.nombre}</h4>
                            <span className="font-functional text-[10px] text-stone-300 uppercase tracking-[0.15em]">{formatCOP(hito.meta)}</span>
                          </div>
                          <p className={`text-[13px] font-light ${unlocked ? 'text-stone-500' : 'text-stone-400'}`}>{hito.premio}</p>
                          {unlocked && <p className="text-[10px] text-gold uppercase tracking-[0.18em] font-semibold mt-2 flex items-center gap-1.5"><span className="w-4 h-px bg-gold/50" />Desbloqueado</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Upsell detal */}
        {!isMayorista && (
          <motion.section {...reveal} className="border border-gold/20 rounded-lg p-8 sm:p-10 text-center bg-gold/[0.02] mb-12">
            <Sparkles size={24} className="text-gold mx-auto mb-4" />
            <p className="text-xl text-stone-800 mb-2" style={{ fontFamily: 'var(--font-serif)' }}>Desbloquea herramientas exclusivas</p>
            <p className="text-sm text-stone-400 font-light max-w-md mx-auto mb-6">Al alcanzar el nivel Mayorista accedes a recompensas, catálogos personalizados y descuentos de hasta 37.5%.</p>
            <Link href="/catalogo" className="inline-flex items-center gap-2 bg-wine text-white px-8 py-3 text-[11px] tracking-[0.12em] uppercase hover:bg-wine-light transition-colors cursor-pointer font-medium">Explorar catálogo <ArrowRight size={14} /></Link>
          </motion.section>
        )}
      </div>
    </div>
  );
}

function getProgress(compras: number, hitos: Array<{ meta: number }>) {
  const next = hitos.find((h) => compras < h.meta);
  const nextMeta = next ? next.meta : hitos[hitos.length - 1].meta;
  const prevIdx = hitos.findIndex((h) => h.meta === nextMeta) - 1;
  const prevMeta = prevIdx >= 0 ? hitos[prevIdx].meta : 0;
  if (nextMeta === prevMeta) return 100;
  return Math.min(100, ((compras - prevMeta) / (nextMeta - prevMeta)) * 100);
}
