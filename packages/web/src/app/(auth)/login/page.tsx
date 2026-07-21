'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/context/ToastProvider';
import GoogleButton from '@/components/ui/GoogleButton';

const DEMO_ACCOUNTS = [
  { email: 'admin@dorela.co', password: 'admin123dorela', nombre: 'Admin Dorela', label: 'Admin' },
  { email: 'detal@dorela.co', password: 'demo123dorela', nombre: 'Cliente Detal', label: 'Detal' },
  { email: 'mayorista@dorela.co', password: 'demo123dorela', nombre: 'Cliente Mayorista', label: 'Por Mayor' },
  { email: 'granmayor@dorela.co', password: 'demo123dorela', nombre: 'Cliente Gran Mayor', label: 'Gran Mayor' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(demoEmail?: string, demoPassword?: string) {
    const targetEmail = demoEmail || email;
    const targetPassword = demoPassword || password;
    if (!targetEmail || !targetPassword) return;
    setLoading(true);
    setError('');
    try {
      const user = await login(targetEmail, targetPassword);
      showToast(`Bienvenido, ${user.nombre}`);
      router.push(user.role === 'admin' ? '/admin' : '/catalogo');
    } catch (e) {
      setError((e as Error).message);
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
          <h2 className="text-2xl font-semibold text-stone-800 text-center mb-1" style={{ fontFamily: 'var(--font-display)' }}>Iniciar Sesión</h2>
          <p className="text-stone-400 text-xs text-center mb-8">Ingresa con tu cuenta</p>

          <GoogleButton />
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-[10px] text-stone-400 uppercase tracking-widest">o</span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>

          <div className="space-y-4 mb-6">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-[10px] font-medium text-stone-500 uppercase tracking-[0.15em]">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com"
                className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-wine/30 focus:ring-1 focus:ring-wine/10 transition-all" />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="block text-[10px] font-medium text-stone-500 uppercase tracking-[0.15em]">Contraseña</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="••••••••"
                className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-wine/30 focus:ring-1 focus:ring-wine/10 transition-all" />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm mb-4 text-center" role="alert">{error}</p>}

          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => handleLogin()}
            disabled={loading || !email || !password}
            className="w-full bg-wine text-white py-3.5 rounded-lg font-semibold text-sm uppercase tracking-[0.12em] disabled:opacity-40 hover:bg-wine-light transition-colors cursor-pointer flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Ingresando...' : 'Ingresar'}
          </motion.button>

          <div className="mt-10">
            <div className="flex items-center gap-4 mb-5">
              <div className="flex-1 separator" />
              <p className="text-[9px] uppercase tracking-[0.25em] text-stone-400 font-medium">Cuentas Demo</p>
              <div className="flex-1 separator" />
            </div>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((u, i) => (
                <motion.button key={u.email} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.08 }} whileHover={{ x: 3 }}
                  onClick={() => handleLogin(u.email, u.password)} disabled={loading}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-lg border border-stone-150 hover:border-wine/20 hover:bg-wine/[0.02] transition-all text-left cursor-pointer group disabled:opacity-30">
                  <div>
                    <p className="text-sm font-medium text-stone-700 group-hover:text-wine transition-colors">{u.nombre}</p>
                    <p className="font-functional text-[10px] text-stone-400">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-wine bg-wine/5 px-3 py-1 rounded-full">{u.label}</span>
                    <ArrowRight size={13} className="text-stone-300 group-hover:text-wine/50 transition-colors" />
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        <p className="text-center text-sm text-stone-400 mt-8">
          ¿No tenés cuenta?{' '}
          <Link href="/registro" className="text-wine hover:text-wine-light font-medium transition-colors">Registrate</Link>
        </p>
      </motion.div>
    </div>
  );
}
