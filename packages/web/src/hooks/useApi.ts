'use client';

import { mapUserFromApi, type MappedUser } from '@/lib/api-client';

const NO_REFRESH_PATHS = new Set([
  '/api/auth/login', '/api/auth/register', '/api/auth/refresh',
  '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/oauth/google',
  '/api/auth/logout',
]);
let refreshPromise: Promise<boolean> | null = null;
let authTransition: Promise<unknown> | null = null;
let sessionVersion = 0;
let authenticated = false;
let sessionInvalid = false;
const sessionListeners = new Set<(wasAuthenticated: boolean) => void>();

export function onSessionInvalid(listener: (wasAuthenticated: boolean) => void) {
  sessionListeners.add(listener);
  return () => { sessionListeners.delete(listener); };
}

function acceptSession() {
  authenticated = true;
  sessionInvalid = false;
  sessionVersion++;
}

function invalidateSession(version: number) {
  if (version !== sessionVersion || sessionInvalid) return;
  const wasAuthenticated = authenticated;
  authenticated = false;
  sessionInvalid = true;
  sessionVersion++;
  sessionListeners.forEach((listener) => listener(wasAuthenticated));
}

export class ApiError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

async function request(method: string, path: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);

  // Finish cookie rotation before a new login can replace those cookies.
  if (NO_REFRESH_PATHS.has(path.split('?')[0]) && refreshPromise) await refreshPromise;
  const version = sessionVersion;
  const wasAuthenticated = authenticated;
  const res = await fetch(path, opts);
  if (res.status === 401 && path.split('?')[0] === '/api/auth/refresh') invalidateSession(version);
  if (res.status === 401 && !NO_REFRESH_PATHS.has(path.split('?')[0])) {
    // A late 401 may belong to a token that another request already rotated.
    const refreshed = version !== sessionVersion
      ? !sessionInvalid
      : await tryRefresh();
    if (refreshed) {
      const retryVersion = sessionVersion;
      const retry = await fetch(path, opts);
      if (retry.status === 401) invalidateSession(retryVersion);
      return retry.json();
    }
    const expired = wasAuthenticated && sessionInvalid;
    throw new ApiError(expired ? 'Sesi\u00f3n expirada' : 'No autenticado',
      expired ? 'SESSION_EXPIRED' : 'UNAUTHENTICATED');
  }
  return res.json();
}

export function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  if (authTransition) return authTransition.then(() => !sessionInvalid, () => false);
  if (sessionInvalid) return Promise.resolve(false);
  const version = sessionVersion;
  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST', credentials: 'include',
      });
      if (res.status === 401) invalidateSession(version);
      if (res.ok && version === sessionVersion) sessionVersion++;
      return res.ok && !sessionInvalid;
    } catch {
      return false;
    }
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

// Serialize cookie-writing auth transitions with rotation in both directions:
// a timer cannot start a refresh after a login/logout has already begun.
function runAuthTransition<T>(action: () => Promise<T>): Promise<T> {
  const previous = authTransition;
  const pending = (async () => {
    if (previous) await previous.catch(() => {});
    if (refreshPromise) await refreshPromise;
    return action();
  })();
  authTransition = pending;
  return pending.finally(() => { if (authTransition === pending) authTransition = null; });
}

function authenticate(path: string, body: unknown, fallback: string): Promise<MappedUser> {
  return runAuthTransition(async () => {
    const res = await request('POST', path, body);
    if (!res.success) throw new ApiError(res.error?.message || fallback, res.error?.code);
    const user = mapUserFromApi(res.data.user);
    acceptSession();
    return user;
  });
}

export const authApi = {
  login(email: string, password: string): Promise<MappedUser> {
    return authenticate('/api/auth/login', { email, password }, 'Error de login');
  },

  register(data: { nombre: string; email: string; password: string }): Promise<MappedUser> {
    return authenticate('/api/auth/register', data, 'Error de registro');
  },

  oauthGoogle(data: { access_token: string; email: string; nombre: string }): Promise<MappedUser> {
    return authenticate('/api/auth/oauth/google', data, 'Error con Google OAuth');
  },

  async me(): Promise<MappedUser | null> {
    const res = await request('GET', '/api/auth/me');
    if (!res.success || sessionInvalid) return null;
    acceptSession();
    return mapUserFromApi(res.data);
  },

  async updateProfile(data: Record<string, string>): Promise<MappedUser> {
    const res = await request('PATCH', '/api/auth/profile', data);
    if (!res.success) throw new Error(res.error?.message || 'Error actualizando perfil');
    return mapUserFromApi(res.data);
  },

  async changePassword(data: { passwordActual: string; passwordNueva: string }) {
    const res = await request('PATCH', '/api/auth/password', data);
    if (!res.success) throw new Error(res.error?.message || 'Error cambiando la contraseña');
    return res.data;
  },

  async forgotPassword(email: string) {
    const res = await request('POST', '/api/auth/forgot-password', { email });
    if (!res.success) throw new Error(res.error?.message || 'Error enviando las instrucciones');
    return res.data;
  },

  async resetPassword(data: { token: string; password: string }) {
    const res = await request('POST', '/api/auth/reset-password', data);
    if (!res.success) throw new Error(res.error?.message || 'Error restableciendo la contraseña');
    return res.data;
  },

  logout() {
    return runAuthTransition(async () => {
      authenticated = false;
      sessionInvalid = true;
      sessionVersion++;
      try {
        // This URL receives the scoped refresh cookie, so Express can revoke it.
        await fetch('/api/auth/refresh', { method: 'DELETE', credentials: 'include' });
      } catch {
        // A network failure must not keep the local user signed in.
      }
    });
  },
};

export { request };
