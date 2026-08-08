'use client';

import { useState } from 'react';
import Link from 'next/link';
import { m } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { authApi } from '@/hooks/useApi';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!email.trim()) {
      setError('Ingresa tu correo electrónico');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await authApi.forgotPassword(email.trim());
      setSuccessMessage(
        result?.message || 'Si el correo existe, enviaremos instrucciones para recuperar la contraseña.',
      );
    } catch (err) {
      setError((err as Error).message || 'No pudimos procesar tu solicitud');
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
            href="/login"
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-wine/70 transition-colors hover:text-wine"
          >
            <ArrowLeft size={14} />
            Volver al login
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
            Recuperar contraseña
          </h2>
          <p className="mb-8 text-center text-xs text-stone-400">
            Te enviaremos instrucciones para restablecer tu acceso.
          </p>

          {successMessage ? (
            <div className="rounded-2xl border border-gold/20 bg-gold/[0.06] p-5 text-center">
              <CheckCircle2 size={24} className="mx-auto mb-3 text-gold" />
              <p className="text-sm leading-relaxed text-stone-600">{successMessage}</p>
              <Link
                href="/login"
                className="mt-5 inline-flex items-center justify-center rounded-full bg-wine px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-wine-light"
              >
                Volver a iniciar sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="forgot-email"
                  className="block text-[10px] font-medium uppercase tracking-[0.15em] text-stone-500"
                >
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@email.com"
                  className="w-full rounded-lg border border-stone-200 px-4 py-3 text-sm transition-all focus:border-wine/30 focus:outline-none focus:ring-1 focus:ring-wine/10"
                />
              </div>

              {error && (
                <p className="text-center text-sm text-red-500" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-wine py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-wine-light disabled:opacity-40"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Enviando...' : 'Enviar instrucciones'}
              </button>
            </form>
          )}
        </m.div>
      </m.div>
    </div>
  );
}
