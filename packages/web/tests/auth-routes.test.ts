// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as refresh, DELETE as revoke } from '../src/app/api/auth/refresh/route';
import { POST as login } from '../src/app/api/auth/login/route';
import { POST as google } from '../src/app/api/auth/oauth/google/route';
import { POST as register } from '../src/app/api/auth/register/route';
import { POST as logout } from '../src/app/api/auth/logout/route';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function req(path: string, cookie = '') {
  return new Request(`http://localhost/api/auth/${path}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: '{}' });
}
function expectCleared(response: Response) {
  const cookies = response.headers.getSetCookie();
  for (const cookie of cookies) {
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toMatch(/SameSite=(?:strict|Strict|lax|Lax)/);
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    if (process.env.NODE_ENV === 'production') expect(cookie).toContain('Secure');
  }
  expect(cookies.some((c) => c.startsWith('accessToken=;') && c.includes('Path=/;'))).toBe(true);
  expect(cookies.some((c) => c.startsWith('refreshToken=;') && /Path=\/;/.test(c))).toBe(true);
  expect(cookies.some((c) => c.startsWith('refreshToken=;') && c.includes('Path=/api/auth/refresh;') && c.includes('Max-Age=0'))).toBe(true);
}
describe('authentication cookie routes', () => {
  it('missing refresh cookie returns 401 and clears all historical cookie paths', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NODE_ENV', 'production');
    const response = await refresh(req('refresh', 'accessToken=stale'));
    expect(response.status).toBe(401); expectCleared(response);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejected refresh expires access and both refresh cookie paths', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: false }, { status: 401 })));
    const response = await refresh(req('refresh', 'refreshToken=revoked'));
    expect(response.status).toBe(401); expectCleared(response);
  });
  it('transient backend errors preserve the cookies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: false }, { status: 503 })));
    const response = await refresh(req('refresh', 'refreshToken=valid'));
    expect(response.status).toBe(503);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
  it.each([['login', login], ['register', register], ['oauth/google', google], ['refresh', refresh]] as const)(
    '%s writes secure scoped cookies and removes the legacy root token', async (path, handler) => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: true, data: { user: { id: 'u1' }, accessToken: 'access', refreshToken: 'rotated' } })));
      const response = await handler(req(path, 'refreshToken=old'));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, data: path === 'refresh' ? {} : { user: { id: 'u1' } } });
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      const cookies = response.headers.getSetCookie();
      expect(cookies.some((c) => c.startsWith('refreshToken=rotated;') && c.includes('Path=/api/auth/refresh;') && c.includes('HttpOnly') && c.includes('Secure') && c.includes('SameSite=strict'))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refreshToken=;') && c.includes('Path=/;') && c.includes('Max-Age=0'))).toBe(true);
    });
  it('logout receives the scoped cookie and revokes it through Express', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await revoke(new Request('http://localhost/api/auth/refresh', {
      method: 'DELETE', headers: { Cookie: 'refreshToken=scoped-token', Origin: 'http://localhost', 'Sec-Fetch-Site': 'same-origin' },
    }));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/auth/logout'), expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ Cookie: 'refreshToken=scoped-token' }),
    }));
    expectCleared(response);
  });
  const crossOriginHeaders: Record<string, string>[] = [
    { Origin: 'https://evil.example' },
    { Origin: 'null' },
    { 'Sec-Fetch-Site': 'cross-site' },
  ];
  it.each(crossOriginHeaders)('rejects cross-origin DELETE without touching tokens or cookies: %j', async (headers) => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const response = await revoke(new Request('http://localhost/api/auth/refresh', {
      method: 'DELETE', headers: { ...headers, Cookie: 'refreshToken=scoped-token' },
    }));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.getSetCookie()).toEqual([]);
  });
  it('logout without a cookie is idempotent and does not reach Express', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const response = await revoke(new Request('http://localhost/api/auth/refresh', { method: 'DELETE' }));
    expect(response.status).toBe(200); expectCleared(response);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('logout clears both cookie variants', async () => { expectCleared(await logout(req('logout'))); });
  it('login preserves INVALID_CREDENTIALS without changing cookies', async () => {
    const error = { code: 'INVALID_CREDENTIALS', message: 'Email o contrase\u00f1a incorrectos' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: false, error }, { status: 401 })));
    const response = await login(req('login'));
    expect(response.status).toBe(401);
    expect((await response.json()).error).toEqual(error);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});
