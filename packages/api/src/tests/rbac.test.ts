import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasPermission, ROLE_PERMISSIONS } from 'shared/src/constants/permissions.js';

const orderService = vi.hoisted(() => ({
  OrderError: class OrderError extends Error { code = 'X'; },
  getAdminOrders: vi.fn(async () => ({ data: [], meta: {} })),
  getAdminOrderById: vi.fn(async () => ({ id: 'o1' })),
  getAdminOrderForPdfById: vi.fn(async () => null),
  createManualOrder: vi.fn(async (..._args: unknown[]) => ({ id: 'o1', orderNumber: 'DOR-1' })),
  updateOrderStatus: vi.fn(async () => ({ id: 'o1', status: 'shipped' })),
  markOrderPaidManually: vi.fn(async () => ({ outcome: 'not_found' })),
  confirmOrder: vi.fn(async () => ({ outcome: 'not_found' })),
}));
const dashboardService = vi.hoisted(() => ({
  ALL_DASHBOARD_SECTIONS: ['core', 'charts', 'inventory'],
  getOperationalDashboard: vi.fn(async () => ({ inventory: {} })),
  getCommercialDashboard: vi.fn(async () => ({ porCobrar: { data: [], total: 0, moreCount: 0 }, enProceso: { data: [], total: 0, moreCount: 0 } })),
  getDashboardData: vi.fn(async () => ({})),
  getRestockAlerts: vi.fn(),
  getSlowMovers: vi.fn(),
  getTierUpgrades: vi.fn(),
}));

vi.mock('../config/db.js', () => ({ prisma: { user: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0), findFirst: vi.fn(async () => ({ id: '22222222-2222-4222-8222-222222222222', email: 'c@x.co', nombre: 'Ana', apellido: 'Test', telefono: '3000000000', empresa: null, direccion: 'Calle 1', ciudad: 'Cali', departamento: 'Valle del Cauca', tier: 'detal', isActive: true })) }, auditLog: { create: vi.fn() } } }));
vi.mock('../config/env.js', () => ({ env: {} }));
vi.mock('../services/admin-user-change-verification.service.js', () => ({
  AdminUserChangeVerificationError: class extends Error {},
  requestSensitiveUserChange: vi.fn(),
  confirmSensitiveUserChange: vi.fn(),
}));
vi.mock('../services/audit.service.js', () => ({ recordAudit: vi.fn() }));
const settings = vi.hoisted(() => ({ getCommercialDiscountLimit: vi.fn(async () => 10), setCommercialDiscountLimit: vi.fn(async (v: unknown) => Number(v)) }));
vi.mock('../services/settings.service.js', () => settings);
vi.mock('../services/order.service.js', () => orderService);
vi.mock('../services/dashboard.service.js', () => dashboardService);
vi.mock('../services/order-pdf.service.js', () => ({ renderOrderPdf: vi.fn() }));
vi.mock('../services/inventory.service.js', () => ({
  getAdminProducts: vi.fn(async () => ({ data: [{ id: 'p1', sku: 'S', nombre: 'N', precioBase: 100, precio: 100, imagenes: [], stock: 3, stockReservado: 0, isActive: true, categoria: null }], meta: {} })),
  updateProduct: vi.fn(async () => ({ id: 'p1', sku: 'S', nombre: 'N', precioBase: 100, stock: 3, stockMinimo: 0, isActive: true, category: null })),
  setProductVisibility: vi.fn(async () => ({ id: 'p1', isActive: false })),
  adjustStock: vi.fn(async () => ({ id: 'p1', stock: 0 })),
  StockAdjustError: class StockAdjustError extends Error { constructor(public code: string, m: string) { super(m); } },
}));
vi.mock('../services/storage.service.js', () => ({ uploadProductImage: vi.fn(), deleteProductImage: vi.fn() }));
vi.mock('../services/product-import.service.js', () => ({ parseWorkbookBuffer: vi.fn(), buildImportPreview: vi.fn(), applyImport: vi.fn() }));
vi.mock('../services/product-export.service.js', () => ({ exportProductsWorkbook: vi.fn(), generateProductTemplateWorkbook: vi.fn() }));

const { default: ordersRouter } = await import('../routes/admin/orders.routes.js');
const { default: productsRouter } = await import('../routes/admin/products.routes.js');
const { default: dashboardRouter } = await import('../routes/admin/dashboard.routes.js');
const { default: usersRouter } = await import('../routes/admin/users.routes.js');
const { errorHandler } = await import('../middleware/errorHandler.js');

function appAs(role: string | null, id = 'user-1') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = role ? ({ id, email: 'a@b.co', role, tier: 'detal' } as never) : null;
    next();
  });
  app.use('/api/admin/orders', ordersRouter);
  app.use('/api/admin/products', productsRouter);
  app.use('/api/admin/dashboard', dashboardRouter);
  app.use('/api/admin/users', usersRouter);
  app.use(errorHandler);
  return app;
}

describe('matriz de permisos por rol', () => {
  it('comercial crea, lee y gestiona el estado/pago de sus propias órdenes, y tiene su propio tablero', () => {
    expect(ROLE_PERMISSIONS.comercial).toEqual(['orders:create', 'orders:read_own', 'orders:update_status', 'orders:mark_paid', 'dashboard:commercial']);
  });

  it('bodega no tiene ningún permiso financiero ni de usuarios', () => {
    for (const permission of ['finance:read', 'commissions:manage', 'expenses:manage', 'dashboard:financial', 'users:manage', 'orders:mark_paid'] as const) {
      expect(hasPermission('bodega', permission)).toBe(false);
    }
  });

  it('admin conserva todos los permisos y un rol desconocido ninguno', () => {
    expect(ROLE_PERMISSIONS.admin.every((p) => hasPermission('admin', p))).toBe(true);
    expect(hasPermission('hacker', 'orders:create')).toBe(false);
    expect(hasPermission(undefined, 'orders:create')).toBe(false);
  });
});

describe('autorización efectiva en los endpoints', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sin sesión devuelve 401', async () => {
    await request(appAs(null)).get('/api/admin/orders').expect(401);
  });

  it('cliente no entra a ninguna ruta del panel', async () => {
    const app = appAs('cliente');
    await request(app).get('/api/admin/orders').expect(403);
    await request(app).get('/api/admin/products').expect(403);
    await request(app).get('/api/admin/dashboard/operational').expect(403);
  });

  it('comercial: no puede tocar productos, inventario, dashboard financiero/operativo ni usuarios, pero sí su propio tablero', async () => {
    const app = appAs('comercial', 'seller-7');
    await request(app).get('/api/admin/products').expect(403);
    await request(app).patch('/api/admin/products/p1/stock').send({}).expect(403);
    await request(app).delete('/api/admin/products/p1').expect(403);
    // Publicar/ocultar en la tienda es solo del administrador
    await request(app).patch('/api/admin/products/p1/visibility').send({ isActive: false }).expect(403);
    await request(app).get('/api/admin/dashboard').expect(403);
    await request(app).get('/api/admin/dashboard/operational').expect(403);
    await request(app).get('/api/admin/users').expect(403);
    await request(app).get('/api/admin/dashboard/commercial').expect(200);
    expect(dashboardService.getCommercialDashboard).toHaveBeenCalledWith('seller-7');
  });

  it('bodega no accede al tablero comercial', async () => {
    await request(appAs('bodega')).get('/api/admin/dashboard/commercial').expect(403);
  });

  it('comercial: puede confirmar y marcar pagado, pero solo en sus propios pedidos', async () => {
    const app = appAs('comercial', 'seller-7');
    await request(app).patch('/api/admin/orders/o1/status').send({ status: 'confirmed' }).expect(200);
    expect(orderService.updateOrderStatus).toHaveBeenCalledWith('o1', 'confirmed', { sellerId: 'seller-7' }, { guia: undefined });
    await request(app).post('/api/admin/orders/o1/mark-paid').expect(404);
    expect(orderService.markOrderPaidManually).toHaveBeenCalledWith('o1', 'seller-7', { sellerId: 'seller-7' });
    await request(app).post('/api/admin/orders/o1/confirm').expect(404);
    expect(orderService.confirmOrder).toHaveBeenCalledWith('o1', { sellerId: 'seller-7' });
  });

  it('comercial: no puede preparar, despachar ni entregar — eso es de bodega', async () => {
    const app = appAs('comercial', 'seller-7');
    for (const status of ['preparado', 'shipped', 'delivered']) {
      await request(app).patch('/api/admin/orders/o1/status').send({ status }).expect(403);
    }
    expect(orderService.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('bodega: prepara y despacha (con guía opcional), pero no confirma pedidos ni aprueba pagos', async () => {
    const app = appAs('bodega', 'bodega-1');
    await request(app).patch('/api/admin/orders/o1/status').send({ status: 'preparado' }).expect(200);
    expect(orderService.updateOrderStatus).toHaveBeenCalledWith('o1', 'preparado', {}, { guia: undefined });
    await request(app).patch('/api/admin/orders/o1/status').send({ status: 'shipped', guia: 'GUIA-001' }).expect(200);
    expect(orderService.updateOrderStatus).toHaveBeenCalledWith('o1', 'shipped', {}, { guia: 'GUIA-001' });
    await request(app).patch('/api/admin/orders/o1/status').send({ status: 'confirmed' }).expect(403);
    await request(app).post('/api/admin/orders/o1/mark-paid').expect(403);
  });

  it('comercial: la lista de órdenes se limita a su propio id', async () => {
    await request(appAs('comercial', 'seller-7')).get('/api/admin/orders').expect(200);
    expect(orderService.getAdminOrders).toHaveBeenCalledWith(expect.anything(), undefined, { sellerId: 'seller-7' });
    await request(appAs('comercial', 'seller-7')).get('/api/admin/orders/o1').expect(200);
    expect(orderService.getAdminOrderById).toHaveBeenCalledWith('o1', { sellerId: 'seller-7' });
  });

  it('comercial: el vendedor sale de la sesión y un sellerId en el cuerpo se rechaza', async () => {
    const valid = {
      comprador: { nombre: 'A', apellido: 'B', telefono: '3001234567', ciudad: 'Cali', direccion: 'Calle 1' },
      items: [{ productId: '11111111-1111-4111-8111-111111111111', cantidad: 1 }],
    };
    const spoofed = await request(appAs('comercial', 'seller-7')).post('/api/admin/orders/manual').send({ ...valid, sellerId: 'otro-vendedor' });
    expect(spoofed.status).toBe(400);
    expect(orderService.createManualOrder).not.toHaveBeenCalled();

    await request(appAs('comercial', 'seller-7')).post('/api/admin/orders/manual').send(valid).expect(201);
    expect(orderService.createManualOrder.mock.calls[0][0]).toBe('seller-7');
  });

  it('bodega: ve todo el flujo operativo pero no el financiero', async () => {
    const app = appAs('bodega', 'bodega-1');
    await request(app).get('/api/admin/products').expect(200);
    await request(app).get('/api/admin/dashboard/operational').expect(200);
    await request(app).get('/api/admin/orders').expect(200);
    expect(orderService.getAdminOrders).toHaveBeenCalledWith(expect.anything(), undefined, {});
    await request(app).patch('/api/admin/orders/o1/status').send({ status: 'shipped' }).expect(200);
    await request(app).get('/api/admin/dashboard').expect(403);
    await request(app).post('/api/admin/orders/o1/mark-paid').expect(403);
    await request(app).post('/api/admin/orders/manual').send({}).expect(403);
    await request(app).get('/api/admin/users').expect(403);
  });

  it('admin conserva el acceso a todo', async () => {
    const app = appAs('admin', 'admin-1');
    await request(app).get('/api/admin/products').expect(200);
    await request(app).get('/api/admin/dashboard').expect(200);
    await request(app).patch('/api/admin/products/p1/visibility').send({ isActive: false }).expect(200);
    await request(app).get('/api/admin/dashboard/operational').expect(200);
    await request(app).get('/api/admin/orders').expect(200);
    await request(app).get('/api/admin/orders/lookup/products').expect(200);
    await request(app).post('/api/admin/orders/o1/mark-paid').expect(404);
    expect(orderService.getAdminOrders).toHaveBeenCalledWith(expect.anything(), undefined, {});
  });

  it('las búsquedas de pedido manual no devuelven precioBase ni datos de proveedor', async () => {
    const res = await request(appAs('comercial')).get('/api/admin/orders/lookup/products').expect(200);
    expect(JSON.stringify(res.body)).not.toMatch(/precioBase|proveedor|alegra/i);
    await request(appAs('bodega')).get('/api/admin/orders/lookup/products').expect(403);
  });

  it('bodega no ve precios, no crea/borra/importa/exporta productos y no puede cambiar el precio', async () => {
    const app = appAs('bodega');
    const list = await request(app).get('/api/admin/products').expect(200);
    expect(list.body.data[0].precioBase).toBeNull();
    expect(list.body.data[0].precio).toBeNull();
    await request(app).post('/api/admin/products').send({}).expect(403);
    await request(app).delete('/api/admin/products/p1').expect(403);
    await request(app).get('/api/admin/products/export').expect(403);
    await request(app).post('/api/admin/products/import/confirm').send({}).expect(403);
    const inventory = await import('../services/inventory.service.js');
    await request(app).put('/api/admin/products/p1').send({ nombre: 'Nuevo', precioBase: 1 }).expect(200);
    const sent = (inventory.updateProduct as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(-1)![1] as Record<string, unknown>;
    expect(sent).not.toHaveProperty('precioBase');
    expect(sent.nombre).toBe('Nuevo');
  });

  it('admin sí ve precios en productos', async () => {
    const list = await request(appAs('admin')).get('/api/admin/products').expect(200);
    expect(list.body.data[0].precioBase).toBe(100);
  });

  it('la búsqueda de clientes exige al menos 3 caracteres', async () => {
    const res = await request(appAs('comercial')).get('/api/admin/orders/lookup/customers?search=ab').expect(200);
    expect(res.body.data).toEqual([]);
  });

  it('detalle de cliente para el pedido manual: comercial y admin sí, bodega no; id inválido → 400', async () => {
    const id = '22222222-2222-4222-8222-222222222222';
    const res = await request(appAs('comercial')).get(`/api/admin/orders/lookup/customers/${id}`).expect(200);
    expect(res.body.data).toMatchObject({ nombre: 'Ana', departamento: 'Valle del Cauca' });
    await request(appAs('admin')).get(`/api/admin/orders/lookup/customers/${id}`).expect(200);
    await request(appAs('bodega')).get(`/api/admin/orders/lookup/customers/${id}`).expect(403);
    await request(appAs('cliente')).get(`/api/admin/orders/lookup/customers/${id}`).expect(403);
    await request(appAs('comercial')).get('/api/admin/orders/lookup/customers/no-es-uuid').expect(400);
  });

  const manualBody = (descuento: number) => ({
    comprador: { nombre: 'A', apellido: 'B', telefono: '3001234567', ciudad: 'Cali', direccion: 'Calle 1' },
    items: [{ productId: '11111111-1111-4111-8111-111111111111', cantidad: 1, descuentoAdicional: descuento }],
  });

  it('el comercial no puede superar el tope de descuento configurado; el admin sí (hasta 100)', async () => {
    const tope = await request(appAs('comercial', 'seller-7')).post('/api/admin/orders/manual').send(manualBody(11));
    expect(tope.status).toBe(400);
    expect(tope.body.error.code).toBe('DISCOUNT_LIMIT_EXCEEDED');
    expect(orderService.createManualOrder).not.toHaveBeenCalled();
    await request(appAs('comercial', 'seller-7')).post('/api/admin/orders/manual').send(manualBody(10)).expect(201);
    await request(appAs('admin', 'admin-1')).post('/api/admin/orders/manual').send(manualBody(100)).expect(201);
    settings.getCommercialDiscountLimit.mockResolvedValueOnce(0);
    await request(appAs('comercial', 'seller-7')).post('/api/admin/orders/manual').send(manualBody(1)).expect(400);
  });

  it('la orden guarda el rol del vendedor al crearla', async () => {
    await request(appAs('comercial', 'seller-7')).post('/api/admin/orders/manual').send(manualBody(0)).expect(201);
    expect(orderService.createManualOrder.mock.calls.at(-1)).toEqual(['seller-7', expect.anything(), 'comercial']);
  });

  it('el tope visible para el pedido: comercial ve el configurado, admin 100, bodega no accede', async () => {
    const c = await request(appAs('comercial')).get('/api/admin/orders/lookup/discount-limit').expect(200);
    expect(c.body.data.maxDescuentoAdicional).toBe(10);
    const a = await request(appAs('admin')).get('/api/admin/orders/lookup/discount-limit').expect(200);
    expect(a.body.data.maxDescuentoAdicional).toBe(100);
    await request(appAs('bodega')).get('/api/admin/orders/lookup/discount-limit').expect(403);
  });

  it('bodega ve las órdenes sin precios, descuentos ni totales y no puede descargar la factura', async () => {
    const orden = { id: 'o1', orderNumber: 'DOR-1', subtotal: 100, total: 80, descuentoAplicado: 0.2, items: [{ sku: 'A', cantidad: 2, precioUnitario: 40, subtotal: 80, descuentoAdicional: 0 }] };
    orderService.getAdminOrders.mockResolvedValueOnce({ data: [orden], meta: {} } as never);
    const lista = await request(appAs('bodega')).get('/api/admin/orders').expect(200);
    expect(lista.body.data[0]).toMatchObject({ orderNumber: 'DOR-1', subtotal: null, total: null, descuentoAplicado: null });
    expect(lista.body.data[0].items[0]).toMatchObject({ sku: 'A', cantidad: 2, precioUnitario: null, subtotal: null });
    orderService.getAdminOrderById.mockResolvedValueOnce(orden as never);
    const detalle = await request(appAs('bodega')).get('/api/admin/orders/o1').expect(200);
    expect(detalle.body.data.total).toBeNull();
    await request(appAs('bodega')).get('/api/admin/orders/o1/pdf').expect(403);
    // El comercial (vendió el pedido) y el admin sí ven los importes
    orderService.getAdminOrderById.mockResolvedValueOnce(orden as never);
    const propio = await request(appAs('comercial', 'seller-7')).get('/api/admin/orders/o1').expect(200);
    expect(propio.body.data.total).toBe(80);
  });

  it('el stock no se cambia por el PUT del producto: va por el ajuste con trazabilidad', async () => {
    const inventory = await import('../services/inventory.service.js');
    await request(appAs('bodega', 'bodega-1')).put('/api/admin/products/p1').send({ nombre: 'Nuevo', stock: 0 }).expect(200);
    expect(inventory.adjustStock).toHaveBeenCalledWith('p1', 0, 'bodega-1');
    const enviado = (inventory.updateProduct as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(-1)![1] as Record<string, unknown>;
    expect(enviado).not.toHaveProperty('stock');
    // por debajo de lo reservado → 409, no 500
    (inventory.adjustStock as unknown as { mockRejectedValueOnce: (e: unknown) => void }).mockRejectedValueOnce(new inventory.StockAdjustError('STOCK_BELOW_RESERVED', 'reservado'));
    await request(appAs('admin')).put('/api/admin/products/p1').send({ stock: 1 }).expect(409);
  });
});
