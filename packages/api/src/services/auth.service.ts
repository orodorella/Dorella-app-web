import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import type { RegisterInput, UpdateProfileInput, ChangePasswordInput } from '../validators/auth.schema.js';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function signAccessToken(user: { id: string; email: string; role: string; tier: string }): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, tier: user.tier },
    env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );
}

function signRefreshToken(userId: string, tokenId: string): string {
  return jwt.sign(
    { sub: userId, jti: tokenId },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' },
  );
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return { error: 'EMAIL_EXISTS' as const };
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      nombre: input.nombre,
      apellido: input.apellido,
      telefono: input.telefono ?? null,
      empresa: input.empresa ?? null,
      nit: input.nit ?? null,
    },
  });

  const accessToken = signAccessToken(user);
  const { refreshToken, expiresAt } = await createRefreshToken(user.id);

  return {
    user: stripSensitive(user),
    accessToken,
    refreshToken,
    refreshTokenExpiresAt: expiresAt,
  };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    return { error: 'INVALID_CREDENTIALS' as const };
  }

  if (!user.passwordHash) {
    return { error: 'OAUTH_USER' as const };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: 'INVALID_CREDENTIALS' as const };
  }

  const accessToken = signAccessToken(user);
  const { refreshToken, expiresAt } = await createRefreshToken(user.id);

  return {
    user: stripSensitive(user),
    accessToken,
    refreshToken,
    refreshTokenExpiresAt: expiresAt,
  };
}

export async function refreshAccessToken(token: string) {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
  } catch {
    return { error: 'INVALID_TOKEN' as const };
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.expiresAt < new Date()) {
    if (stored) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
    }
    return { error: 'INVALID_TOKEN' as const };
  }

  // Rotation: delete used token
  await prisma.refreshToken.delete({ where: { id: stored.id } });

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    return { error: 'INVALID_TOKEN' as const };
  }

  const accessToken = signAccessToken(user);
  const { refreshToken: newRefreshToken, expiresAt } = await createRefreshToken(user.id);

  return {
    accessToken,
    refreshToken: newRefreshToken,
    refreshTokenExpiresAt: expiresAt,
  };
}

export async function logout(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { error: 'NOT_FOUND' as const };
  }
  return { user: stripSensitive(user) };
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  if (input.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing && existing.id !== userId) {
      return { error: 'EMAIL_IN_USE' as const };
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.nombre !== undefined && { nombre: input.nombre }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.telefono !== undefined && { telefono: input.telefono }),
      ...(input.ciudad !== undefined && { ciudad: input.ciudad }),
      ...(input.direccion !== undefined && { direccion: input.direccion }),
    },
  });

  return { user: stripSensitive(user) };
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: 'NOT_FOUND' as const };

  if (user.provider === 'google') {
    return { error: 'OAUTH_USER' as const };
  }

  if (!user.passwordHash) {
    return { error: 'OAUTH_USER' as const };
  }

  const valid = await bcrypt.compare(input.passwordActual, user.passwordHash);
  if (!valid) {
    return { error: 'WRONG_PASSWORD' as const };
  }

  const newHash = await bcrypt.hash(input.passwordNueva, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  });

  return { success: true as const };
}

export async function googleOAuth(supabaseAccessToken: string, email: string, nombre: string) {
  const supabase = getSupabaseAdmin();
  const { data, error: supaError } = await supabase.auth.getUser(supabaseAccessToken);
  if (supaError || !data.user) {
    return { error: 'INVALID_OAUTH_TOKEN' as const };
  }

  if (data.user.email !== email) {
    return { error: 'EMAIL_MISMATCH' as const };
  }

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: null,
        nombre,
        apellido: '',
        provider: 'google',
      },
    });
  }

  if (!user.isActive) {
    return { error: 'ACCOUNT_DISABLED' as const };
  }

  const accessToken = signAccessToken(user);
  const { refreshToken, expiresAt } = await createRefreshToken(user.id);

  return {
    user: stripSensitive(user),
    accessToken,
    refreshToken,
    refreshTokenExpiresAt: expiresAt,
  };
}

async function createRefreshToken(userId: string) {
  const tokenId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
  const refreshToken = signRefreshToken(userId, tokenId);

  await prisma.refreshToken.create({
    data: { userId, token: refreshToken, expiresAt },
  });

  return { refreshToken, expiresAt };
}

function stripSensitive(user: {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  empresa: string | null;
  nit: string | null;
  direccion: string | null;
  ciudad: string | null;
  departamento: string | null;
  role: string;
  tier: string;
  provider: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    apellido: user.apellido,
    telefono: user.telefono,
    empresa: user.empresa,
    nit: user.nit,
    direccion: user.direccion,
    ciudad: user.ciudad,
    departamento: user.departamento,
    role: user.role,
    tier: user.tier,
    provider: user.provider,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
