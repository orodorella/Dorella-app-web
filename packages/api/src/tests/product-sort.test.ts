import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductQuerySchema, PRODUCT_SORT_VALUES } from '../validators/product.schema.js';

const mocks = vi.hoisted(() => {
  const findMany = vi.fn(async (_args: any) => [] as any[]);
  const count = vi.fn(async (_args?: any) => 0);
  return { findMany, count, prisma: { product: { findMany, count } } };
});

vi.mock('../config/db.js', () => ({ prisma: mocks.prisma }));

import { getProducts } from '../services/inventory.service.js';

/** El orderBy con el que quedó la consulta de la última llamada. */
function ultimoOrderBy() {
  return (mocks.findMany.mock.calls[0][0] as any).orderBy;
}

describe('orden del catálogo', () => {
  beforeEach(() => {
    mocks.findMany.mockClear();
    mocks.count.mockClear();
  });

  it('sin parámetro ordena por destacados y nombre, como siempre', async () => {
    await getProducts(null, {}, {});
    expect(ultimoOrderBy()).toEqual([{ isFeatured: 'desc' }, { nombre: 'asc' }]);
  });

  it('ordena por precio usando precioBase, no el precio ya descontado', async () => {
    await getProducts('por_mayor', { sort: 'precio_desc' }, {});
    expect(ultimoOrderBy()).toEqual([{ precioBase: 'desc' }, { nombre: 'asc' }]);

    mocks.findMany.mockClear();
    await getProducts(null, { sort: 'precio_asc' }, {});
    expect(ultimoOrderBy()).toEqual([{ precioBase: 'asc' }, { nombre: 'asc' }]);
  });

  it('cubre alfabético y novedades', async () => {
    await getProducts(null, { sort: 'nombre_desc' }, {});
    expect(ultimoOrderBy()).toEqual([{ nombre: 'desc' }]);

    mocks.findMany.mockClear();
    await getProducts(null, { sort: 'recientes' }, {});
    expect(ultimoOrderBy()).toEqual([{ createdAt: 'desc' }, { nombre: 'asc' }]);
  });

  it('cada opción del schema tiene un orden definido', async () => {
    for (const sort of PRODUCT_SORT_VALUES) {
      mocks.findMany.mockClear();
      await getProducts(null, { sort }, {});
      expect(Array.isArray(ultimoOrderBy())).toBe(true);
    }
  });

  it('el schema pone destacados por defecto y rechaza un orden inventado', () => {
    expect(ProductQuerySchema.parse({}).sort).toBe('destacados');
    expect(() => ProductQuerySchema.parse({ sort: 'lo-que-sea' })).toThrow();
  });
});
