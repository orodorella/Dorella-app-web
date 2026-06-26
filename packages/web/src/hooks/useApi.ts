'use client';

import { mapUserFromApi, type MappedUser } from '@/lib/api-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let accessToken: string | null = null;
let logoutCallback: (() => void) | null = null;

export function setAccessToken(token: string) { accessToken = token; }
export function clearAccessToken() { accessToken = null; }
export function onLogout(cb: () => void) { logoutCallback = cb; }

async function request(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const opts: RequestInit = { method, headers, credentials: 'include' };
  if (body && method !== 'GET') {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, opts);

  if (res.status === 401 && path !== '/api/auth/refresh') {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      const retry = await fetch(`${API_BASE}${path}`, { ...opts, headers });
      return retry.json();
    }
    if (logoutCallback) logoutCallback();
    throw new Error('Sesión expirada');
  }

  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.success && data.data.accessToken) {
      accessToken = data.data.accessToken;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export const authApi = {
  async login(email: string, password: string): Promise<MappedUser> {
    const res = await request('POST', '/api/auth/login', { email, password });
    if (!res.success) throw new Error(res.error?.message || 'Error de login');
    setAccessToken(res.data.accessToken);
    return mapUserFromApi(res.data.user);
  },

  async register(data: { nombre: string; email: string; password: string }): Promise<MappedUser> {
    const res = await request('POST', '/api/auth/register', data);
    if (!res.success) throw new Error(res.error?.message || 'Error de registro');
    setAccessToken(res.data.accessToken);
    return mapUserFromApi(res.data.user);
  },

  async oauthGoogle(data: { access_token: string; email: string; nombre: string }): Promise<MappedUser> {
    const res = await request('POST', '/api/auth/oauth/google', data);
    if (!res.success) throw new Error(res.error?.message || 'Error con Google OAuth');
    setAccessToken(res.data.accessToken);
    return mapUserFromApi(res.data.user);
  },

  async me(): Promise<MappedUser | null> {
    const res = await request('GET', '/api/auth/me');
    if (!res.success) return null;
    return mapUserFromApi(res.data);
  },

  async updateProfile(data: Record<string, string>): Promise<MappedUser> {
    const res = await request('PATCH', '/api/auth/profile', data);
    if (!res.success) throw new Error(res.error?.message || 'Error actualizando perfil');
    return mapUserFromApi(res.data);
  },

  async changePassword(data: { passwordActual: string; passwordNueva: string }) {
    const res = await request('PATCH', '/api/auth/password', data);
    if (!res.success) throw new Error(res.error?.message || 'Error cambiando contraseña');
    return res.data;
  },

  async logout() {
    try { await request('POST', '/api/auth/logout'); } catch { /* ignore */ }
    clearAccessToken();
  },
};

export { request };
