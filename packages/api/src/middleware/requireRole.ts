import type { Request, Response, NextFunction } from 'express';
import type { Role } from 'shared/src/types/user.js';
import { error } from '../utils/response.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    console.warn(`[SECURITY] Unauthenticated access attempt to ${req.path} from ${req.ip}`);
    error(res, 401, 'UNAUTHORIZED', 'Autenticación requerida');
    return;
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      console.warn(`[SECURITY] Unauthenticated access attempt to ${req.path} from ${req.ip}`);
      error(res, 401, 'UNAUTHORIZED', 'Autenticación requerida');
      return;
    }
    if (!roles.includes(req.user.role)) {
      console.warn(`[SECURITY] Forbidden: user ${req.user.id} (role=${req.user.role}) tried to access ${req.path}`);
      error(res, 403, 'FORBIDDEN', 'No tienes permisos para esta acción');
      return;
    }
    next();
  };
}
