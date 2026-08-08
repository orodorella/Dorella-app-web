'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { m } from 'framer-motion';
import { Loader2, ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/context/ToastProvider';
import GoogleButton from '@/components/ui/GoogleButton';

const DEMO_ACCOUNTS: Array<{ email: string; password: string; nombre: string; label: string }> = [];

export default function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory p-4">
      <m.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-md"
      >
        <div className="mb-6 flex justify-start">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-wine/70 transition-colors hover:text-wine"
          >
            <ArrowLeft size={14} />
            Volver al inicio
          </Link>
        </div>

        <div className="mb-12 text-center">
          <m.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="mb-3 text-6xl text-wine"
            style={{ fontFamily: 'var(--font-script)' }}
          >
            D&apos;orella
          </m.h1>
          <m.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-[10px] uppercase tracking-[0.4em] text-stone-400"
          >
            Joyería en Oro Laminado 18k
          </m.p>
        </div>

        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="rounded-lg border border-stone-100 bg-white p-8 shadow-luxury sm:p-10"
        >
          <h2
            className="mb-1 text-center text-2xl font-semibold text-stone-800"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Iniciar sesión
          </h2>
          <p className="mb-8 text-center text-xs text-stone-400">Ingresa con tu cuenta</p>

          <GoogleButton />
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-stone-200" />
            <span className="text-[10px] uppercase tracking-widest text-stone-400">o</span>
            <div className="h-px flex-1 bg-stone-200" />
          </div>

          <div className="mb-6 space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-[10px] font-medium uppercase tracking-[0.15em] text-stone-500"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
                className="w-full rounded-lg border border-stone-200 px-4 py-3 text-sm transition-all focus:border-wine/30 focus:outline-none focus:ring-1 focus:ring-wine/10"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-[10px] font-medium uppercase tracking-[0.15em] text-stone-500"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleLogin()}
                  placeholder="********"
                  className="w-full rounded-lg border border-stone-200 px-4 py-3 pr-10 text-sm transition-all focus:border-wine/30 focus:outline-none focus:ring-1 focus:ring-wine/10"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-stone-400 transition-colors hover:text-wine"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-[11px] font-medium text-wine/70 transition-colors hover:text-wine"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </div>

          {error && (
            <p className="mb-4 text-center text-sm text-red-500" role="alert">
              {error}
            </p>
          )}

          <m.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => handleLogin()}
            disabled={loading || !email || !password}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-wine py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-wine-light disabled:opacity-40"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Ingresando...' : 'Ingresar'}
          </m.button>

          {DEMO_ACCOUNTS.length > 0 && (
            <div className="mt-10">
              <div className="mb-5 flex items-center gap-4">
                <div className="separator flex-1" />
                <p className="text-[9px] font-medium uppercase tracking-[0.25em] text-stone-400">
                  Cuentas Demo
                </p>
                <div className="separator flex-1" />
              </div>
              <div className="space-y-2">
                {DEMO_ACCOUNTS.map((account, index) => (
                  <m.button
                    key={account.email}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.08 }}
                    whileHover={{ x: 3 }}
                    onClick={() => handleLogin(account.email, account.password)}
                    disabled={loading}
                    className="group flex w-full cursor-pointer items-center justify-between rounded-lg border border-stone-150 px-4 py-3.5 text-left transition-all hover:border-wine/20 hover:bg-wine/[0.02] disabled:opacity-30"
                  >
                    <div>
                      <p className="text-sm font-medium text-stone-700 transition-colors group-hover:text-wine">
                        {account.nombre}
                      </p>
                      <p className="font-functional text-[10px] text-stone-400">{account.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-wine/5 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-wine">
                        {account.label}
                      </span>
                      <ArrowRight
                        size={13}
                        className="text-stone-300 transition-colors group-hover:text-wine/50"
                      />
                    </div>
                  </m.button>
                ))}
              </div>
            </div>
          )}
        </m.div>

        <p className="mt-8 text-center text-sm text-stone-400">
          ¿No tienes cuenta?{' '}
          <Link href="/registro" className="font-medium text-wine transition-colors hover:text-wine-light">
            Regístrate
          </Link>
        </p>
      </m.div>
    </div>
  );
}
