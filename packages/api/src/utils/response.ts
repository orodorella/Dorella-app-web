import type { Response } from 'express';
import type { PaginationMeta } from 'shared/src/types/api.js';

export function success<T>(res: Response, data: T, status = 200, meta?: PaginationMeta): void {
  const body: Record<string, unknown> = { success: true, data };
  if (meta) body.meta = meta;
  res.status(status).json(body);
}

export function error(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: Array<{ field: string; message: string }>,
): void {
  const errorBody: Record<string, unknown> = { code, message };
  if (details) errorBody.details = details;
  res.status(status).json({ success: false, error: errorBody });
}
