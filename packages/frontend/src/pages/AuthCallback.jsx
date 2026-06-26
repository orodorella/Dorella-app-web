import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { supabase } from '../services/supabase'
import { auth } from '../services/api'

export default function AuthCallback() {
  const { dispatch, showToast } = useApp()
  const navigate = useNavigate()
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    async function handleCallback() {
      try {
        if (!supabase) throw new Error('Supabase no configurado')

        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !session) throw new Error('No se pudo obtener la sesión de Google')

        const user = await auth.oauthGoogle({
          access_token: session.access_token,
          email: session.user.email,
          nombre: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '',
        })

        dispatch({ type: 'LOGIN', payload: user })
        showToast(`Bienvenido, ${user.nombre}`)
        navigate(user.role === 'admin' ? '/admin' : '/catalogo', { replace: true })
      } catch (err) {
        showToast(err.message || 'Error al iniciar sesión con Google', 'error')
        navigate('/login', { replace: true })
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center">
      <div className="text-center">
        <Loader2 size={40} className="animate-spin text-wine mx-auto mb-6" />
        <p className="text-lg text-stone-700" style={{ fontFamily: 'var(--font-display)' }}>
          Iniciando sesión...
        </p>
        <p className="text-sm text-stone-400 mt-2">Conectando con Google</p>
      </div>
    </div>
  )
}
