import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const { db, config, getUser } = vi.hoisted(() => ({
  db: {
    user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    passwordResetToken: { updateMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    refreshToken: { deleteMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
  config: {
    NODE_ENV: 'test', FRONTEND_URL: 'https://shop.example',
    NEXT_PUBLIC_SITE_URL: '', SITE_URL: '', RESEND_API_KEY: 'test-key',
    EMAIL_FROM: 'accounts@example.com', JWT_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32),
  },
  getUser: vi.fn(),
}));

vi.mock('../config/db.js', () => ({ prisma: db }));
vi.mock('../config/env.js', () => ({ env: config }));
vi.mock('../config/supabase.js', () => ({ getSupabaseAdmin: () => ({ auth: { getUser } }) }));

import { forgotPassword, resetPassword, login, googleOAuth } from '../services/auth.service.js';
import { ForgotPasswordSchema, ResetPasswordSchema } from '../validators/auth.schema.js';

const fetchMock = vi.fn();
function makeUser() {
  return {
    id: 'user-1', email: 'customer@example.com', nombre: 'Cliente', apellido: '',
    provider: 'google', passwordHash: null as string | null, isActive: true,
    role: 'cliente', tier: 'detal', createdAt: new Date(), updatedAt: new Date(),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  config.FRONTEND_URL = 'https://shop.example';
  config.RESEND_API_KEY = 'test-key';
  config.EMAIL_FROM = 'accounts@example.com';
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({ ok: true });
  db.user.findFirst.mockResolvedValue(makeUser());
  db.$transaction.mockImplementation((operations) => Promise.all(operations));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Password recovery for Google and email accounts', () => {
  it.each(['google', 'email'])('sends a recovery link for an active %s account', async (provider) => {
    db.user.findFirst.mockResolvedValue({ ...makeUser(), provider, passwordHash: provider === 'email' ? 'existing-hash' : null });
    expect(await forgotPassword({ email: 'CUSTOMER@example.com' })).toEqual({ queued: true });
    expect(db.user.findFirst.mock.calls[0][0].where.email).toEqual({ equals: 'customer@example.com', mode: 'insensitive' });
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    const body = JSON.parse(request.body);
    expect(body.to).toEqual(['customer@example.com']);
    expect(body.from).toBe('accounts@example.com');
    const link = body.text.match(/https:\/\/shop\.example\/reset-password\?token=([a-f0-9]{64})/);
    expect(link).not.toBeNull();
    const stored = db.passwordResetToken.create.mock.calls[0][0].data;
    expect(stored.tokenHash).toBe(crypto.createHash('sha256').update(link[1]).digest('hex'));
    expect(stored.tokenHash).not.toBe(link[1]);
    expect(stored.expiresAt.getTime() - Date.now()).toBeGreaterThan(3_590_000);
    expect(stored.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(3_600_000);
    expect(db.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', usedAt: null }, data: { usedAt: expect.any(Date) },
    });
  });

  it.each([null, { ...makeUser(), isActive: false }])('does not send or create tokens for missing/inactive accounts', async (user) => {
    db.user.findFirst.mockResolvedValue(user);
    expect(await forgotPassword({ email: 'customer@example.com' })).toEqual({ queued: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it.each(['missing-url', 'missing-key', 'missing-sender', 'provider-error', 'network-error'])('records %s but still reports queued', async (failure) => {
    if (failure === 'missing-url') config.FRONTEND_URL = '';
    if (failure === 'missing-key') config.RESEND_API_KEY = '';
    if (failure === 'missing-sender') config.EMAIL_FROM = '';
    if (failure === 'provider-error') fetchMock.mockResolvedValue({ ok: false, status: 403, text: async () => 'Forbidden' });
    if (failure === 'network-error') fetchMock.mockRejectedValue(new Error('Network unavailable'));
    expect(await forgotPassword({ email: 'customer@example.com' })).toEqual({ queued: true });
    expect(console.error).toHaveBeenCalled();
    if (failure.startsWith('missing-')) expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows a Google account to set a password, log in with it, and keep Google access', async () => {
    const user = makeUser();
    const token = { id: 'reset-1', userId: user.id, user, usedAt: null as Date | null, expiresAt: new Date(Date.now() + 60_000) };
    db.passwordResetToken.findUnique.mockResolvedValue(token);
    db.user.findUnique.mockImplementation(async () => user);
    db.user.update.mockImplementation(async ({ data }) => Object.assign(user, data));
    db.passwordResetToken.update.mockImplementation(async ({ data }) => Object.assign(token, data));
    expect(await login(user.email, 'NewPassword123!')).toEqual({ error: 'OAUTH_USER' });
    expect(await resetPassword({ token: 'test-token', password: 'NewPassword123!' })).toEqual({ success: true });
    expect(await bcrypt.compare('NewPassword123!', user.passwordHash!)).toBe(true);
    expect(user.provider).toBe('email');
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(db.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: user.id } });
    expect(db.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id, usedAt: null, id: { not: 'reset-1' } }, data: { usedAt: expect.any(Date) },
    });
    expect(await login(user.email, 'NewPassword123!')).toHaveProperty('accessToken');
    expect(await login(user.email, 'WrongPassword')).toEqual({ error: 'INVALID_CREDENTIALS' });
    getUser.mockResolvedValue({ data: { user: { email: user.email } }, error: null });
    expect(await googleOAuth('supabase-test-token', user.email, user.nombre)).toHaveProperty('accessToken');
    expect(await resetPassword({ token: 'test-token', password: 'AnotherPassword!' })).toEqual({ error: 'INVALID_OR_EXPIRED_TOKEN' });
    expect(db.user.update).toHaveBeenCalledOnce();
  });

  it.each(['missing', 'used', 'expired', 'inactive'])('rejects %s recovery tokens without changing credentials', async (state) => {
    db.passwordResetToken.findUnique.mockResolvedValue(state === 'missing' ? null : {
      id: 'reset-1', userId: 'user-1', user: { ...makeUser(), isActive: state !== 'inactive' },
      usedAt: state === 'used' ? new Date() : null,
      expiresAt: new Date(Date.now() + (state === 'expired' ? -1000 : 60_000)),
    });
    expect(await resetPassword({ token: 'test-token', password: 'NewPassword123!' })).toEqual({ error: 'INVALID_OR_EXPIRED_TOKEN' });
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('rejects malformed emails, missing tokens, and passwords outside 8–128 characters', () => {
    expect(ForgotPasswordSchema.safeParse({ email: 'invalid' }).success).toBe(false);
    expect(ResetPasswordSchema.safeParse({ token: '', password: 'ValidPassword123' }).success).toBe(false);
    for (const password of ['short', 'a'.repeat(129)]) {
      expect(ResetPasswordSchema.safeParse({ token: 'token', password }).success).toBe(false);
    }
  });
});
