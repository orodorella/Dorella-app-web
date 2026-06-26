import { useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { auth } from '../services/api'
import { Loader2 } from 'lucide-react'
import GoogleButton from '../components/GoogleButton'

export default function Registro() {
  const { user, dispatch, showToast } = useApp()
  const navigate = useNavigate()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (user) return <Navigate to="/catalogo" replace />

  function validate() {
    if (!nombre.trim()) return 'El nombre es requerido'
    if (!email.trim()) return 'El email es requerido'
    if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
    if (password !== confirmPassword) return 'Las contraseñas no coinciden'
    return null
  }

  async function handleRegister(e) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)
    setError('')
    try {
      const registeredUser = await auth.register({ nombre: nombre.trim(), email: email.trim(), password })
      dispatch({ type: 'LOGIN', payload: registeredUser })
      showToast(`Bienvenido, ${registeredUser.nombre}`)
      navigate('/catalogo')
    } catch (err) {
      const msg = err.message
      if (msg.includes('existe') || msg.includes('EMAIL_EXISTS') || msg.includes('duplicate')) {
        setError('Este email ya está registrado')
      } else {
        setError(msg || 'Error al crear la cuenta')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-12">
          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-6xl text-wine mb-3"
            style={{ fontFamily: 'var(--font-script)' }}
          >
            D'orella
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-stone-400 text-[10px] tracking-[0.4em] uppercase"
          >
            Joyería en Oro Laminado 18k
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="bg-white rounded-lg shadow-luxury p-8 sm:p-10 border border-stone-100"
        >
          <h2 className="text-2xl font-semibold text-stone-800 text-center mb-1" style={{ fontFamily: 'var(--font-display)' }}>
            Crear Cuenta
          </h2>
          <p className="text-stone-400 text-xs text-center mb-8">
            Registrate para acceder al catálogo
          </p>

          <GoogleButton />

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-[10px] text-stone-400 uppercase tracking-widest">o</span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>

          <form onSubmit={handleRegister} className="space-y-4 mb-6">
            <div className="space-y-2">
              <label htmlFor="nombre" className="block text-[10px] font-medium text-stone-500 uppercase tracking-[0.15em]">
                Nombre completo
              </label>
              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre"
                className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-wine/30 focus:ring-1 focus:ring-wine/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="reg-email" className="block text-[10px] font-medium text-stone-500 uppercase tracking-[0.15em]">
                Email
              </label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-wine/30 focus:ring-1 focus:ring-wine/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="reg-password" className="block text-[10px] font-medium text-stone-500 uppercase tracking-[0.15em]">
                Contraseña
              </label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-wine/30 focus:ring-1 focus:ring-wine/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="reg-confirm" className="block text-[10px] font-medium text-stone-500 uppercase tracking-[0.15em]">
                Confirmar contraseña
              </label>
              <input
                id="reg-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRegister(e)}
                placeholder="Repetí tu contraseña"
                className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-wine/30 focus:ring-1 focus:ring-wine/10 transition-all"
              />
            </div>

            {error && <p className="text-red-500 text-sm text-center" role="alert">{error}</p>}

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              className="w-full bg-wine text-white py-3.5 rounded-lg font-semibold text-sm uppercase tracking-[0.12em] disabled:opacity-40 hover:bg-wine-light transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </motion.button>
          </form>

          <p className="text-center text-sm text-stone-400">
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="text-wine hover:text-wine-light font-medium transition-colors">
              Iniciá sesión
            </Link>
          </p>
        </motion.div>

        <p className="text-center text-stone-300 text-[9px] mt-8 tracking-[0.25em] uppercase">
          Plataforma B2B Dorela
        </p>
      </motion.div>
    </div>
  )
}
