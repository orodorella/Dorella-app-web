import type { Request, Response, NextFunction } from 'express';
import { hasPermission, type Permission } from 'shared/src/constants/permissions.js';
import { error } from '../utils/response.js';

/** Exige que el rol del usuario autenticado tenga al menos uno de los permisos. */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      console.warn(`[SECURITY] Unauthenticated access attempt to ${req.path} from ${req.ip}`);
      error(res, 401, 'UNAUTHORIZED', 'Autenticación requerida');
      return;
    }
    if (!permissions.some((permission) => hasPermission(req.user!.role, permission))) {
      console.warn(`[SECURITY] Forbidden: user ${req.user.id} (role=${req.user.role}) lacks ${permissions.join('|')} for ${req.path}`);
      error(res, 403, 'FORBIDDEN', 'No tienes permisos para esta acción');
      return;
    }
    next();
  };
}
