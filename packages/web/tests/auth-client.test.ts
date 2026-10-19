import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const user = { id: 'u1', nombre: 'Ana', apellido: '', email: 'ana@example.com', tier: 'detal', role: 'cliente' };
const ok = () => Response.json({ success: true, data: { user } });
const unauthorized = () => Response.json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Email o contrase\u00f1a incorrectos' } }, { status: 401 });
let client: typeof import('../src/hooks/useApi');
const fetchMock = vi.fn<typeof fetch>();
beforeEach(async () => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  client = await import('../src/hooks/useApi');
});
afterEach(() => vi.unstubAllGlobals());

async function login() {
  fetchMock.mockResolvedValueOnce(ok());
  await client.authApi.login(user.email, 'valid-password');
  fetchMock.mockReset();
}

describe('authentication HTTP client', () => {
  it.each(['login', 'register', 'refresh', 'forgot-password', 'reset-password', 'oauth/google'])(
    'does not refresh a 401 from %s', async (endpoint) => {
      fetchMock.mockResolvedValue(unauthorized());
      await client.request('POST', `/api/auth/${endpoint}`);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

  it('preserves the login error message and code', async () => {
    fetchMock.mockResolvedValue(unauthorized());
    await expect(client.authApi.login(user.email, 'wrong')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS', message: 'Email o contrase\u00f1a incorrectos',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares one refresh across simultaneous 401 responses and the timer', async () => {
    await login();
    let finish!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => { finish = resolve; });
    let rotated = false;
    fetchMock.mockImplementation(async (path) => {
      if (path === '/api/auth/refresh') return pending;
      return rotated ? ok() : unauthorized();
    });
    const requests = [client.request('GET', '/api/orders'), client.request('GET', '/api/products')];
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', expect.anything()));
    const timer = client.tryRefresh();
    rotated = true;
    finish(ok());
    await Promise.all([...requests, timer]);
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/auth/refresh')).toHaveLength(1);
  });

  it('does not start another refresh for a late 401 from the old token', async () => {
    await login();
    let finish!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => { finish = resolve; });
    fetchMock.mockImplementation(async (path) => path === '/api/late' ? pending : unauthorized());
    const late = client.request('GET', '/api/late');
    fetchMock.mockResolvedValueOnce(unauthorized()).mockImplementation(async () => ok());
    await client.request('GET', '/api/first');
    finish(unauthorized());
    await late;
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/auth/refresh')).toHaveLength(1);
  });

  it('invalid refresh clears a known session once, stops retries, and permits a new login', async () => {
    await login();
    const invalidated = vi.fn();
    client.onSessionInvalid(invalidated);
    fetchMock.mockResolvedValue(unauthorized());
    const results = await Promise.allSettled([
      client.request('GET', '/api/orders'), client.request('GET', '/api/profile'),
    ]);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(invalidated).toHaveBeenCalledExactlyOnceWith(true);
    await expect(client.request('GET', '/api/orders')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/auth/refresh')).toHaveLength(1);
    fetchMock.mockResolvedValue(ok());
    await expect(client.authApi.login(user.email, 'valid')).resolves.toMatchObject({ id: 'u1' });
    expect(await client.tryRefresh()).toBe(true);
  });

  it('does not report expiry when restoring an anonymous visitor', async () => {
    const invalidated = vi.fn();
    client.onSessionInvalid(invalidated);
    fetchMock.mockResolvedValue(unauthorized());
    await expect(client.authApi.me()).rejects.toMatchObject({ message: 'No autenticado' });
    expect(invalidated).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('retries a protected request only once even if the replacement is rejected', async () => {
    await login();
    fetchMock.mockImplementation(async (path) => path === '/api/auth/refresh' ? ok() : unauthorized());
    await client.request('GET', '/api/orders');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(await client.tryRefresh()).toBe(false);
  });

  it('does not clear authentication or report expiry for refresh service outages', async () => {
    await login();
    const invalidated = vi.fn();
    client.onSessionInvalid(invalidated);
    fetchMock.mockImplementation(async (path) => path === '/api/auth/refresh'
      ? new Response('', { status: 503 }) : unauthorized());
    await expect(client.request('GET', '/api/orders')).rejects.toMatchObject({ message: 'No autenticado' });
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('does not let the timer rotate cookies while a new login is pending', async () => {
    await login();
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const attempt = client.authApi.login(user.email, 'valid-password');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const timer = client.tryRefresh();
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/auth/refresh')).toHaveLength(0);
    finish(ok());
    await attempt;
    expect(await timer).toBe(true);
  });

  it('waits for an existing refresh before sending a login', async () => {
    await login();
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const refresh = client.tryRefresh();
    const attempt = client.authApi.login(user.email, 'valid-password');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValue(ok());
    finish(unauthorized());
    await refresh;
    await expect(attempt).resolves.toMatchObject({ id: 'u1' });
    expect(await client.tryRefresh()).toBe(true);
  });

  it('serializes logout before a new login so cookie cleanup cannot erase the new session', async () => {
    await login();
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const logout = client.authApi.logout();
    const attempt = client.authApi.login(user.email, 'valid-password');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValue(ok());
    finish(ok());
    await logout;
    await expect(attempt).resolves.toMatchObject({ id: 'u1' });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/login');
    expect(await client.tryRefresh()).toBe(true);
  });

  it('logout sends the revocation request to the scoped cookie path', async () => {
    await login();
    fetchMock.mockResolvedValue(ok());
    await client.authApi.logout();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/auth/refresh', { method: 'DELETE', credentials: 'include' });
    expect(await client.tryRefresh()).toBe(false);
  });

  it('Google login still accepts the user and preserves OAuth failures', async () => {
    fetchMock.mockResolvedValueOnce(ok());
    await expect(client.authApi.oauthGoogle({ access_token: 'supabase-token', email: user.email, nombre: 'Ana' }))
      .resolves.toMatchObject({ id: 'u1' });
    fetchMock.mockResolvedValueOnce(Response.json({ success: false, error: { code: 'INVALID_OAUTH_TOKEN', message: 'Token de Google inv\u00e1lido' } }, { status: 401 }));
    await expect(client.authApi.oauthGoogle({ access_token: 'bad', email: user.email, nombre: 'Ana' }))
      .rejects.toMatchObject({ code: 'INVALID_OAUTH_TOKEN' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
