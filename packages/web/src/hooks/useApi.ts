'use client';

import { mapUserFromApi, type MappedUser } from '@/lib/api-client';

async function request(method: string, path: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  };
  if (body && method !== 'GET') {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(path, opts);

  if (res.status === 401 && path !== '/api/auth/refresh') {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retry = await fetch(path, opts);
      return retry.json();
    }
    throw new Error('Sesión expirada');
  }

  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const authApi = {
  async login(email: string, password: string): Promise<MappedUser> {
    const res = await request('POST', '/api/auth/login', { email, password });
    if (!res.success) throw new Error(res.error?.message || 'Error de login');
    return mapUserFromApi(res.data.user);
  },

  async register(data: { nombre: string; email: string; password: string }): Promise<MappedUser> {
    const res = await request('POST', '/api/auth/register', data);
    if (!res.success) throw new Error(res.error?.message || 'Error de registro');
    return mapUserFromApi(res.data.user);
  },

  async oauthGoogle(data: { access_token: string; email: string; nombre: string }): Promise<MappedUser> {
    const res = await request('POST', '/api/auth/oauth/google', data);
    if (!res.success) throw new Error(res.error?.message || 'Error con Google OAuth');
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
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch { /* ignore */ }
  },
};

export { request };
