import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mocks = vi.hoisted(() => ({
  refreshToken: { findUnique: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
  user: { findUnique: vi.fn(), create: vi.fn() },
  getUser: vi.fn(),
}));
vi.mock('../config/db.js', () => ({ prisma: mocks }));
vi.mock('../config/env.js', () => ({ env: {
  JWT_SECRET: 'test-access-secret-at-least-32-characters',
  JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters',
} }));
vi.mock('../config/supabase.js', () => ({ getSupabaseAdmin: () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock('../middleware/rateLimiter.js', () => ({ loginLimiter: (_req: unknown, _res: unknown, next: () => void) => next() }));
import router from '../routes/auth.routes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { logout } from '../services/auth.service.js';

const app = express();
app.use(express.json(), cookieParser());
app.use('/api/auth', router);
app.use(errorHandler);
const secret = 'test-refresh-secret-at-least-32-characters';
const token = () => jwt.sign({ sub: 'u1', jti: 't1' }, secret, { expiresIn: '7d' });
const user = {
  id: 'u1', email: 'ana@example.com', nombre: 'Ana', apellido: '', role: 'cliente', tier: 'detal',
  provider: 'google', passwordHash: null, isActive: true, createdAt: new Date(), updatedAt: new Date(),
};
const refresh = (value?: string) => {
  const req = request(app).post('/api/auth/refresh');
  return value ? req.set('Cookie', `refreshToken=${value}`) : req;
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.findUnique.mockResolvedValue(user);
  mocks.refreshToken.findUnique.mockResolvedValue({ id: 't1', expiresAt: new Date(Date.now() + 60_000) });
  mocks.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
  mocks.refreshToken.create.mockResolvedValue({});
});

describe('refresh route and token revocation', () => {
  it('returns controlled 401 for absent, malformed, expired JWT, or revoked tokens', async () => {
    expect((await refresh()).status).toBe(401);
    expect((await refresh('invalid')).status).toBe(401);
    expect((await refresh(jwt.sign({ sub: 'u1' }, secret, { expiresIn: -1 }))).status).toBe(401);
    mocks.refreshToken.findUnique.mockResolvedValueOnce(null);
    const response = await refresh(token());
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_TOKEN');
  });

  it('expires stored tokens idempotently even if another request deleted them', async () => {
    mocks.refreshToken.findUnique.mockResolvedValue({ id: 't1', expiresAt: new Date(0) });
    mocks.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
    const responses = await Promise.all([refresh(token()), refresh(token())]);
    expect(responses.map((r) => r.status)).toEqual([401, 401]);
    expect(mocks.refreshToken.create).not.toHaveBeenCalled();
  });

  it('two simultaneous refreshes consume the same token once without P2025 or 500', async () => {
    // Barrier ensures both requests read the row before either can consume it.
    let readers = 0;
    let release!: () => void;
    const bothRead = new Promise<void>((resolve) => { release = resolve; });
    mocks.refreshToken.findUnique.mockImplementation(async () => {
      if (++readers === 2) release();
      await bothRead;
      return { id: 't1', expiresAt: new Date(Date.now() + 60_000) };
    });
    let present = true;
    mocks.refreshToken.deleteMany.mockImplementation(async () => {
      const count = present ? 1 : 0;
      present = false;
      return { count };
    });
    const responses = await Promise.all([refresh(token()), refresh(token())]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 401]);
    expect(mocks.refreshToken.create).toHaveBeenCalledTimes(1);
    const success = responses.find((r) => r.status === 200)!;
    expect(jwt.verify(success.body.data.refreshToken, secret)).toMatchObject({ sub: 'u1' });
    expect(success.body.data.refreshToken).not.toBe(token());
  });

  it('does not issue tokens if logout won the race or the account is disabled', async () => {
    mocks.refreshToken.deleteMany.mockResolvedValueOnce({ count: 0 });
    expect((await refresh(token())).status).toBe(401);
    mocks.user.findUnique.mockResolvedValueOnce({ ...user, isActive: false });
    expect((await refresh(token())).status).toBe(401);
    expect(mocks.refreshToken.create).not.toHaveBeenCalled();
  });

  it('logout is idempotent', async () => {
    mocks.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
    await expect(logout(token())).resolves.toBeUndefined();
    await expect(logout(token())).resolves.toBeUndefined();
    expect((await request(app).post('/api/auth/logout')).status).toBe(200);
  });

  it('login keeps INVALID_CREDENTIALS and its specific message', async () => {
    mocks.user.findUnique.mockResolvedValueOnce(null);
    const response = await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong-password' });
    expect(response.status).toBe(401);
    expect(response.body.error).toEqual({ code: 'INVALID_CREDENTIALS', message: 'Email o contrase\u00f1a incorrectos' });
  });

  it('Google login still validates Supabase identity and issues tokens', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { email: user.email } }, error: null });
    const response = await request(app).post('/api/auth/oauth/google').send({ access_token: 'supabase-token', email: user.email, nombre: 'Ana' });
    expect(response.status).toBe(200);
    expect(response.body.data.user.id).toBe('u1');
    expect(response.body.data.accessToken).toBeTruthy();
    expect(mocks.refreshToken.create).toHaveBeenCalledTimes(1);
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid' } });
    const invalid = await request(app).post('/api/auth/oauth/google').send({ access_token: 'invalid', email: user.email });
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.code).toBe('INVALID_OAUTH_TOKEN');
  });
});
