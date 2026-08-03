'use client';

import { createClient } from '@supabase/supabase-js';

function sanitizeEnv(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, '') || '';
}

function validateSupabaseUrl(value: string) {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
}

const rawSupabaseUrl = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const rawSupabaseAnonKey = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const parsedSupabaseUrl = validateSupabaseUrl(rawSupabaseUrl);

const supabaseUrl = parsedSupabaseUrl?.toString() || '';
const supabaseAnonKey = rawSupabaseAnonKey;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (process.env.NODE_ENV !== 'production') {
  console.log('[supabase] config', {
    hasUrl: Boolean(rawSupabaseUrl),
    hasAnonKey: Boolean(rawSupabaseAnonKey),
    urlHost: parsedSupabaseUrl?.hostname || null,
  });
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function signInWithGoogle() {
  if (!supabase) {
    return {
      error: {
        message: 'Google login no está configurado correctamente.',
      },
    } as const;
  }

  try {
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const normalizedMessage = message.toLowerCase();

    return {
      error: {
        message: normalizedMessage.includes('fetch')
          ? 'No se pudo conectar con Supabase. Revisa la URL pública, la anon key y la configuración del proveedor Google.'
          : message || 'No fue posible iniciar sesión con Google.',
      },
    } as const;
  }
}
