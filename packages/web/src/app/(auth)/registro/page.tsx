'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { m } from 'framer-motion';
import { Loader2, Eye, EyeOff } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      router.replace('/catalogo');
    }
  }, [router, user]);

  if (user) {
    return null;
  }

  function validate() {
    if (!nombre.trim()) return 'El nombre es requerido';
    if (!email.trim()) return 'El email es requerido';
    if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    if (password !== confirmPassword) return 'Las contraseñas no coinciden';
    return null;
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const registeredUser = await register({
        nombre: nombre.trim(),
        email: email.trim(),
        password,
      });
      showToast(`Bienvenido, ${registeredUser.nombre}`);
      router.push('/catalogo');
    } catch (err) {
      const msg = (err as Error).message;
      setError(
        msg.includes('existe') || msg.includes('EMAIL_EXISTS')
          ? 'Este email ya está registrado'
          : msg || 'Error al crear la cuenta',
      );
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
            Crear Cuenta
          </h2>
          <p className="mb-8 text-center text-xs text-stone-400">
            Regístrate para acceder al catálogo
          </p>

          <GoogleButton />
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-stone-200" />
            <span className="text-[10px] uppercase tracking-widest text-stone-400">o</span>
            <div className="h-px flex-1 bg-stone-200" />
          </div>

          <form onSubmit={handleRegister} className="mb-6 space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="nombre"
                className="block text-[10px] font-medium uppercase tracking-[0.15em] text-stone-500"
              >
                Nombre completo
              </label>
              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Tu nombre"
                className="w-full rounded-lg border border-stone-200 px-4 py-3 text-sm transition-all focus:border-wine/30 focus:outline-none focus:ring-1 focus:ring-wine/10"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="reg-email"
                className="block text-[10px] font-medium uppercase tracking-[0.15em] text-stone-500"
              >
                Email
              </label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
                className="w-full rounded-lg border border-stone-200 px-4 py-3 text-sm transition-all focus:border-wine/30 focus:outline-none focus:ring-1 focus:ring-wine/10"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="reg-password"
                className="block text-[10px] font-medium uppercase tracking-[0.15em] text-stone-500"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo 8 caracteres"
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

            <div className="space-y-2">
              <label
                htmlFor="reg-confirm"
                className="block text-[10px] font-medium uppercase tracking-[0.15em] text-stone-500"
              >
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  id="reg-confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repite tu contraseña"
                  className="w-full rounded-lg border border-stone-200 px-4 py-3 pr-10 text-sm transition-all focus:border-wine/30 focus:outline-none focus:ring-1 focus:ring-wine/10"
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

            {error && (
              <p className="text-center text-sm text-red-500" role="alert">
                {error}
              </p>
            )}

            <m.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-wine py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-wine-light disabled:opacity-40"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </m.button>
          </form>

          <p className="text-center text-sm text-stone-400">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-medium text-wine transition-colors hover:text-wine-light">
              Inicia sesión
            </Link>
          </p>
        </m.div>
      </m.div>
    </div>
  );
}
