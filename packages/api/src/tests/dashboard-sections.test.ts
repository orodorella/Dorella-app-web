import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ $queryRaw: vi.fn(async () => []), order: { findMany: vi.fn(async () => []) } }));
vi.mock('../config/db.js', () => ({ prisma: db }));

const svc = await import('../services/dashboard.service.js');
const { default: router } = await import('../routes/admin/dashboard.routes.js');
const { errorHandler } = await import('../middleware/errorHandler.js');

const queriesRun = () => db.$queryRaw.mock.calls.length + db.order.findMany.mock.calls.length;

describe('Dashboard por secciones', () => {
  beforeEach(() => vi.clearAllMocks());

  it('por defecto calcula todo (14 consultas) y conserva la forma de la respuesta', async () => {
    const data = await svc.getDashboardData(30);
    expect(queriesRun()).toBe(14);
    for (const key of ['summary', 'inventory', 'customers', 'topProducts', 'restockAlerts', 'ordersByStatus', 'revenueTimeline', 'recentOrders', 'revenueByTier', 'salesByCategory', 'topCustomers', 'tierUpgrades', 'slowMovers']) {
      expect(data).toHaveProperty(key);
    }
  });

  it('«core» ejecuta solo las 4 consultas de KPIs y devuelve listas vacías para lo demás', async () => {
    const data = await svc.getDashboardData(30, ['core']);
    expect(queriesRun()).toBe(4);
    expect(data.summary).toMatchObject({ revenue: 0, orders: 0 });
    expect(data.revenueTimeline).toEqual([]);
    expect(data.topProducts).toEqual([]);
    expect(data.recentOrders).toEqual([]);
  });

  it('«charts» (6 consultas) e «inventory» (2) son independientes de «core»', async () => {
    await svc.getDashboardData(30, ['charts']);
    expect(queriesRun()).toBe(6);
    vi.clearAllMocks();
    await svc.getDashboardData(30, ['inventory']);
    expect(queriesRun()).toBe(2);
  });

  it('la ruta acepta ?sections=, ignora valores inválidos y exige permiso financiero', async () => {
    const app = (role: string) => {
      const a = express();
      a.use((req, _res, next) => { req.user = { id: 'u', email: 'a@b.co', role, tier: 'detal' } as never; next(); });
      a.use('/api/admin/dashboard', router);
      a.use(errorHandler);
      return a;
    };
    await request(app('admin')).get('/api/admin/dashboard?days=30&sections=core').expect(200);
    expect(queriesRun()).toBe(4);
    vi.clearAllMocks();
    await request(app('admin')).get('/api/admin/dashboard?days=30&sections=basura,otra').expect(200);
    expect(queriesRun()).toBe(14); // valores inválidos → se cae al comportamiento completo
    await request(app('bodega')).get('/api/admin/dashboard?sections=core').expect(403);
    await request(app('comercial')).get('/api/admin/dashboard?sections=core').expect(403);
  });
});
