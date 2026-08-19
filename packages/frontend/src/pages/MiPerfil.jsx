import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Mail, Phone, MapPin, FileText, Edit3, Package,
  ArrowRight, Star, Download, Link2, Plus, Loader2, X, Save, Shield,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { auth } from '../services/api'

const MOCK_CATALOGOS = [
  { id: 1, nombre: 'Catálogo Aretes Primavera', fecha: '12/06/2025', productos: 24, formato: 'PDF', estado: 'Activo' },
  { id: 2, nombre: 'Línea Cadenas Oro 18k', fecha: '05/06/2025', productos: 18, formato: 'Enlace', estado: 'Activo' },
  { id: 3, nombre: 'Selección Anillos Compromiso', fecha: '20/05/2025', productos: 12, formato: 'PDF', estado: 'Expirado' },
]

const reveal = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
}

function staggerReveal(i) {
  return { ...reveal, transition: { ...reveal.transition, delay: i * 0.08 } }
}

export default function MiPerfil() {
  const { user, tier, tierInfo, dispatch, showToast } = useApp()
  const [editingSection, setEditingSection] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ passwordActual: '', passwordNueva: '', confirmar: '' })
  const [savingPassword, setSavingPassword] = useState(false)

  if (!user) return null

  const isMayorista = tier === 'mayorista' || tier === 'granmayorista'
  const isGranMayor = tier === 'granmayorista'
  const isEmailProvider = !user.provider || user.provider === 'email'

  const tierBadgeClass = isGranMayor
    ? 'bg-gold/10 text-gold border-gold/20'
    : tier === 'mayorista'
    ? 'bg-wine/10 text-wine border-wine/20'
    : 'bg-stone-100 text-stone-500 border-stone-200'

  function startEditing() {
    setEditForm({
      nombre: user.nombre || '',
      email: user.email || '',
      telefono: user.telefono || '',
      ciudad: user.ciudad || '',
      direccion: user.direccion || '',
    })
    setEditingSection('datos')
  }

  function cancelEditing() {
    setEditingSection(null)
    setEditForm({})
  }

  async function saveProfile() {
    setSaving(true)
    try {
      const updatedUser = await auth.updateProfile(editForm)
      dispatch({ type: 'LOGIN', payload: updatedUser })
      showToast('Perfil actualizado')
      setEditingSection(null)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (passwordForm.passwordNueva !== passwordForm.confirmar) {
      showToast('Las contraseñas no coinciden', 'error')
      return
    }
    if (passwordForm.passwordNueva.length < 8) {
      showToast('La nueva contraseña debe tener al menos 8 caracteres', 'error')
      return
    }
    setSavingPassword(true)
    try {
      await auth.changePassword({
        passwordActual: passwordForm.passwordActual,
        passwordNueva: passwordForm.passwordNueva,
      })
      showToast('Contraseña actualizada')
      setPasswordForm({ passwordActual: '', passwordNueva: '', confirmar: '' })
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSavingPassword(false)
    }
  }

  const isEditing = editingSection === 'datos'

  const profileFields = [
    { label: 'Nombre completo', key: 'nombre', value: user.nombre, icon: User },
    { label: 'Email', key: 'email', value: user.email || '—', icon: Mail },
    { label: 'Teléfono', key: 'telefono', value: user.telefono || '—', icon: Phone },
    { label: 'Dirección de despacho', key: 'direccion', value: user.direccion || '—', icon: MapPin },
    { label: 'Ciudad', key: 'ciudad', value: user.ciudad || '—', icon: MapPin },
  ]

  return (
    <div className="flex-1 bg-white min-h-screen">
      <div className="max-w-[900px] mx-auto px-6 py-10">

        {/* SECTION ? MIS CATÁLOGOS ══════════ */}
        <AnimatePresence>
          {isMayorista && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mb-12 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[clamp(1.5rem,3vw,2rem)] text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
                  Mis catálogos
                </h2>
                <button className="flex items-center gap-2 bg-wine text-white px-5 py-2.5 text-[11px] tracking-[0.1em] uppercase hover:bg-wine-light transition-colors cursor-pointer font-medium">
                  <Plus size={13} /> Generar catálogo
                </button>
              </div>

              {MOCK_CATALOGOS.length > 0 ? (
                <div className="grid gap-3">
                  <div className="hidden sm:grid grid-cols-[1fr_100px_80px_80px_80px] gap-4 px-5 py-2.5 text-[9px] font-semibold text-stone-400 uppercase tracking-[0.18em]">
                    <div>Catálogo</div>
                    <div>Fecha</div>
                    <div className="text-center">Productos</div>
                    <div className="text-center">Formato</div>
                    <div className="text-center">Estado</div>
                  </div>

                  {MOCK_CATALOGOS.map((cat, i) => (
                    <motion.div
                      key={cat.id}
                      {...staggerReveal(i)}
                      className="border border-stone-200 rounded-lg px-5 py-4 hover:border-stone-300 transition-colors"
                    >
                      <div className="hidden sm:grid grid-cols-[1fr_100px_80px_80px_80px] gap-4 items-center">
                        <div>
                          <p className="text-[13px] font-semibold text-stone-700 tracking-wide">{cat.nombre}</p>
                        </div>
                        <p className="font-functional text-[12px] text-stone-400">{cat.fecha}</p>
                        <p className="font-functional text-[12px] text-stone-500 text-center">{cat.productos}</p>
                        <div className="text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-stone-500">
                            {cat.formato === 'PDF' ? <Download size={11} /> : <Link2 size={11} />}
                            {cat.formato}
                          </span>
                        </div>
                        <div className="text-center">
                          <span className={`text-[9px] font-semibold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full border ${
                            cat.estado === 'Activo'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              : 'bg-stone-50 text-stone-400 border-stone-200'
                          }`}>
                            {cat.estado}
                          </span>
                        </div>
                      </div>

                      <div className="sm:hidden">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[13px] font-semibold text-stone-700">{cat.nombre}</p>
                          <span className={`text-[9px] font-semibold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full border ${
                            cat.estado === 'Activo'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              : 'bg-stone-50 text-stone-400 border-stone-200'
                          }`}>
                            {cat.estado}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-stone-400 font-light">
                          <span>{cat.fecha}</span>
                          <span>{cat.productos} productos</span>
                          <span className="flex items-center gap-1">
                            {cat.formato === 'PDF' ? <Download size={10} /> : <Link2 size={10} />}
                            {cat.formato}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="border border-stone-200 rounded-lg p-10 text-center">
                  <div className="w-16 h-16 bg-stone-100 rounded-lg flex items-center justify-center mx-auto mb-5">
                    <FileText size={28} className="text-stone-300" />
                  </div>
                  <p className="text-lg text-stone-700 mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
                    Aún no tienes catálogos
                  </p>
                  <p className="text-sm text-stone-400 font-light mb-6 max-w-sm mx-auto">
                    Genera tu primer catálogo sin marca y compártelo con tus clientes. Tú defines los precios, tú manejas tu negocio.
                  </p>
                  <button className="inline-flex items-center gap-2 bg-wine text-white px-8 py-3 text-[11px] tracking-[0.12em] uppercase hover:bg-wine-light transition-colors cursor-pointer font-medium">
                    <Plus size={14} /> Crear mi primer catálogo
                  </button>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}

