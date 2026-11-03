/**
 * Filtros y paginación de productos (administración) contra un Postgres REAL y desechable.
 * Se omite sin TEST_DATABASE_URL; exige host local y nombre de base con "test".
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  const url = new URL(TEST_DATABASE_URL);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('TEST_DATABASE_URL debe apuntar a una BD local desechable');
  if (!/test/i.test(url.pathname)) throw new Error('El nombre de la base de pruebas debe contener "test"');
}

describe.skipIf(!TEST_DATABASE_URL)('productos: filtros y paginación en la base', () => {
  let prisma: PrismaClient;
  let inventory: typeof import('../services/inventory.service.js');
  const tag = randomUUID().slice(0, 8);
  const provider = `Prov-${tag}`;

  const list = async (q: Record<string, unknown>) => inventory.getAdminProducts({ pageSize: 100, search: tag, ...q });

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    ({ prisma } = await import('../config/db.js'));
    inventory = await import('../services/inventory.service.js');
    const category = await prisma.category.create({ data: { nombre: `Cat ${tag}`, slug: `cat-${tag}` } });
    const rows: Array<[string, number, number, string | null]> = [
      // nombre, stock, stockMinimo, proveedor
      ['Agotado sin mínimo', 0, 0, provider],
      ['Agotado con mínimo', 0, 5, provider],
      ['Bajo exacto', 5, 5, provider],
      ['Bajo menor', 2, 5, null],
      ['Normal sin mínimo', 10, 0, provider],
      ['Normal con mínimo', 20, 5, null],
      // mismo nombre repetido: el orden debe seguir siendo estable entre páginas
      ['Duplicado', 7, 0, null], ['Duplicado', 7, 0, null], ['Duplicado', 7, 0, null], ['Duplicado', 7, 0, null],
    ];
    for (const [i, [nombre, stock, stockMinimo, proveedor]] of rows.entries()) {
      await prisma.product.create({ data: { sku: `F-${tag}-${i}`, nombre: `${nombre} ${tag}`, precioBase: 1000, categoryId: category.id, stock, stockMinimo, proveedor } });
    }
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('el filtro de estado en la base coincide con la regla getStockStatus para cada producto', async () => {
    const all = (await list({})).data;
    expect(all.length).toBe(10);
    for (const estado of ['sin_existencias', 'reabastecer', 'normal'] as const) {
      const filtered = (await list({ estado })).data;
      const expected = all.filter((p) => inventory.getStockStatus(p.stock, p.stockMinimo) === estado);
      expect(filtered.map((p) => p.id).sort()).toEqual(expected.map((p) => p.id).sort());
      expect(filtered.length).toBeGreaterThan(0);
    }
  });

  it('el estado «reabastecer» incluye stock = mínimo y excluye agotados y sin mínimo', async () => {
    const nombres = (await list({ estado: 'reabastecer' })).data.map((p) => p.nombre);
    expect(nombres.some((n) => n.startsWith('Bajo exacto'))).toBe(true);
    expect(nombres.some((n) => n.startsWith('Bajo menor'))).toBe(true);
    expect(nombres.some((n) => n.startsWith('Agotado'))).toBe(false);
    expect(nombres.some((n) => n.startsWith('Normal sin mínimo'))).toBe(false);
  });

  it('filtra por proveedor', async () => {
    const result = (await list({ proveedor: provider })).data;
    expect(result.length).toBe(4);
    expect(result.every((p) => p.proveedor === provider)).toBe(true);
  });

  it('la lista de proveedores sale de la base e incluye el proveedor de prueba', async () => {
    expect(await inventory.getProductProviders()).toContain(provider);
  });

  it('la paginación es estable: recorrer páginas de 3 en 3 devuelve cada producto una sola vez, aun con nombres repetidos', async () => {
    const seen: string[] = [];
    let total = 0;
    for (let page = 1; page <= 5; page += 1) {
      const r = await list({ pageSize: 3, page });
      total = r.meta.total;
      seen.push(...r.data.map((p) => p.id));
    }
    expect(total).toBe(10);
    expect(seen.length).toBe(10);
    expect(new Set(seen).size).toBe(10);
  });

  it('la búsqueda es parcial, sin distinguir mayúsculas, y cubre SKU y descripción', async () => {
    expect((await inventory.getAdminProducts({ search: `BAJO EXACTO ${tag.toUpperCase()}` })).data.length).toBe(1);
    expect((await inventory.getAdminProducts({ search: `F-${tag}-3` })).data.length).toBe(1);
  });
});
