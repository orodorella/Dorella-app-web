'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/context/ToastProvider';
import GoogleButton from '@/components/ui/GoogleButton';

export default function RegistroPage() {
  const { user, register } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user) { router.replace('/catalogo'); return null; }

  function validate() {
    if (!nombre.trim()) return 'El nombre es requerido';
    if (!email.trim()) return 'El email es requerido';
    if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    if (password !== confirmPassword) return 'Las contraseñas no coinciden';
    return null;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setLoading(true);
    setError('');
    try {
      const registeredUser = await register({ nombre: nombre.trim(), email: email.trim(), password });
      showToast(`Bienvenido, ${registeredUser.nombre}`);
      router.push('/catalogo');
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg.includes('existe') || msg.includes('EMAIL_EXISTS') ? 'Este email ya está registrado' : msg || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }} className="w-full max-w-md">
        <div className="text-center mb-12">
          <motion.h1 initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.1 }}
            className="text-6xl text-wine mb-3" style={{ fontFamily: 'var(--font-script)' }}>D&apos;orella</motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="text-stone-400 text-[10px] tracking-[0.4em] uppercase">Joyería en Oro Laminado 18k</motion.p>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
          className="bg-white rounded-lg shadow-luxury p-8 sm:p-10 border border-stone-100">
          <h2 className="text-2xl font-semibold text-stone-800 text-center mb-1" style={{ fontFamily: 'var(--font-display)' }}>Crear Cuenta</h2>
          <p className="text-stone-400 text-xs text-center mb-8">Registrate para acceder al catálogo</p>

          <GoogleButton />
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-[10px] text-stone-400 uppercase tracking-widest">o</span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>

          <form onSubmit={handleRegister} className="space-y-4 mb-6">
            {[
              { id: 'nombre', label: 'Nombre completo', type: 'text', value: nombre, setter: setNombre, placeholder: 'Tu nombre' },
              { id: 'reg-email', label: 'Email', type: 'email', value: email, setter: setEmail, placeholder: 'tu@email.com' },
              { id: 'reg-password', label: 'Contraseña', type: 'password', value: password, setter: setPassword, placeholder: 'Mínimo 8 caracteres' },
              { id: 'reg-confirm', label: 'Confirmar contraseña', type: 'password', value: confirmPassword, setter: setConfirmPassword, placeholder: 'Repetí tu contraseña' },
            ].map((f) => (
              <div key={f.id} className="space-y-2">
                <label htmlFor={f.id} className="block text-[10px] font-medium text-stone-500 uppercase tracking-[0.15em]">{f.label}</label>
                <input id={f.id} type={f.type} value={f.value} onChange={(e) => f.setter(e.target.value)} placeholder={f.placeholder}
                  className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-wine/30 focus:ring-1 focus:ring-wine/10 transition-all" />
              </div>
            ))}
            {error && <p className="text-red-500 text-sm text-center" role="alert">{error}</p>}
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} type="submit" disabled={loading}
              className="w-full bg-wine text-white py-3.5 rounded-lg font-semibold text-sm uppercase tracking-[0.12em] disabled:opacity-40 hover:bg-wine-light transition-colors cursor-pointer flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </motion.button>
          </form>
          <p className="text-center text-sm text-stone-400">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="text-wine hover:text-wine-light font-medium transition-colors">Iniciá sesión</Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
