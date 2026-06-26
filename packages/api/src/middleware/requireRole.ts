import type { Request, Response, NextFunction } from 'express';
import type { Role } from 'shared/src/types/user.js';
import { error } from '../utils/response.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    error(res, 401, 'UNAUTHORIZED', 'Autenticación requerida');
    return;
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      error(res, 401, 'UNAUTHORIZED', 'Autenticación requerida');
      return;
    }
    if (!roles.includes(req.user.role)) {
      error(res, 403, 'FORBIDDEN', 'No tienes permisos para esta acción');
      return;
    }
    next();
  };
}
