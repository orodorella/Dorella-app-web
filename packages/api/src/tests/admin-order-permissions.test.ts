import { describe, expect, it, vi } from 'vitest';
import { requireRole } from '../middleware/requireRole.js';

describe('permisos para pedidos manuales', () => {
  it('deniega la operación a un usuario que no es administrador', () => {
    const middleware = requireRole('admin');
    const req = { user: { id: 'user-1', role: 'cliente' }, path: '/manual', ip: '127.0.0.1' } as any;
    const json = vi.fn();
    const res = { status: vi.fn(() => ({ json })) } as any;
    const next = vi.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
