import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Role, Tier } from 'shared/src/types/user.js';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  tier: Tier;
}

declare global {
  namespace Express {
    interface Request {
      user: AuthUser | null;
    }
  }
}

// tier/role are read fresh from the DB on every request instead of trusting
// the JWT payload — the access token can live up to 15 minutes, and pricing
// must reflect a tier change (manual or purchase-triggered) immediately, not
// whenever the token happens to expire/refresh.
export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    req.user = null;
    next();
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string },
      select: { id: true, email: true, role: true, tier: true, isActive: true },
    });

    if (!user || !user.isActive) {
      req.user = null;
      next();
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as Role,
      tier: user.tier as Tier,
    };
  } catch {
    req.user = null;
  }
  next();
}
