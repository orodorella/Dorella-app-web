'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/context/ToastProvider';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const { oauthGoogle } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    async function handleCallback() {
      try {
        if (!isSupabaseConfigured || !supabase) {
          throw new Error('Google login no está configurado todavía.');
        }

        const url = new URL(window.location.href);
        const authCode = url.searchParams.get('code');

        if (authCode) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
          if (exchangeError) {
            throw exchangeError;
          }
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          throw new Error('No se pudo obtener la sesión de Google');
        }

        const user = await oauthGoogle({
          access_token: session.access_token,
          email: session.user.email || '',
          nombre: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '',
        });

        showToast(`Bienvenido, ${user.nombre}`);
        router.replace(user.role === 'admin' ? '/admin' : '/catalogo');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al iniciar sesión con Google';
        showToast(message, 'error');
        router.replace('/login');
      }
    }

    handleCallback();
  }, [oauthGoogle, showToast, router]);

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
  );
}
