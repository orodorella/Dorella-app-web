import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Role, Tier } from 'shared/src/types/user.js';
import { env } from '../config/env.js';

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

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    req.user = null;
    next();
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    req.user = {
      id: payload.sub as string,
      email: payload.email as string,
      role: payload.role as Role,
      tier: payload.tier as Tier,
    };
  } catch {
    req.user = null;
  }
  next();
}
