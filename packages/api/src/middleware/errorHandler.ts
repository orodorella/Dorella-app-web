import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details },
    });
    return;
  }

  console.error('Unhandled error:', err);

  const status = typeof err.status === 'number' ? err.status : 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Error interno del servidor'
    : (err instanceof Error ? err.message : 'Error desconocido');

  res.status(status).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message },
  });
};
