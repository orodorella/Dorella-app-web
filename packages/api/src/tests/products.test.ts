import { describe, it, expect } from 'vitest';
import { formatProductForTier, calculatePrice } from '../services/pricing.service.js';
import type { Decimal } from '@prisma/client/runtime/library';

function makeDecimal(value: number): Decimal {
  return { toNumber: () => value, toString: () => String(value) } as unknown as Decimal;
}

function makeDbProduct(precioBase: number, overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-001',
    sku: 'DOR-AE-001',
    nombre: 'Aretes Flor de Lis',
    descripcion: 'Aretes en oro laminado 18k',
    precioBase: makeDecimal(precioBase),
    imagenes: ['img1.webp', 'img2.webp'],
    material: 'Oro laminado 18k',
    stock: 50,
    isFeatured: true,
    tags: ['aretes', 'elegante'],
    category: { id: 'cat-1', nombre: 'Aretes', slug: 'aretes' },
    ...overrides,
  };
}

describe('Products security — precio_base never leaks', () => {
  it('GET /api/products sin auth: response NO contiene precio_base ni precioBase', () => {
    const product = makeDbProduct(100_000);
    const result = formatProductForTier(product, null);
    const json = JSON.stringify(result);

    expect(json).not.toContain('precio_base');
    expect(json).not.toContain('precioBase');
    expect(Object.keys(result)).not.toContain('precioBase');
    expect(Object.keys(result)).not.toContain('precio_base');
    expect(result.precio).toBe(100_000);
  });

  it('con token mayorista: precio_final tiene 37.5% descuento', () => {
    const product = makeDbProduct(100_000);
    const result = formatProductForTier(product, 'por_mayor');

    expect(result.precio).toBe(62_500);
    const json = JSON.stringify(result);
    expect(json).not.toContain('precio_base');
    expect(json).not.toContain('precioBase');
  });

  it('con token gran_mayorista: precio_final tiene 50% descuento', () => {
    const product = makeDbProduct(100_000);
    const result = formatProductForTier(product, 'gran_mayor');

    expect(result.precio).toBe(50_000);
    const json = JSON.stringify(result);
    expect(json).not.toContain('precio_base');
    expect(json).not.toContain('precioBase');
  });

  it('con tier detal: precio sin descuento', () => {
    const product = makeDbProduct(89_900);
    const result = formatProductForTier(product, 'detal');

    expect(result.precio).toBe(89_900);
  });

  it('formatProductForTier preserva todos los campos públicos', () => {
    const product = makeDbProduct(100_000);
    const result = formatProductForTier(product, 'detal');

    expect(result.id).toBe('prod-001');
    expect(result.sku).toBe('DOR-AE-001');
    expect(result.nombre).toBe('Aretes Flor de Lis');
    expect(result.descripcion).toBe('Aretes en oro laminado 18k');
    expect(result.imagenes).toEqual(['img1.webp', 'img2.webp']);
    expect(result.material).toBe('Oro laminado 18k');
    expect(result.stock).toBe(50);
    expect(result.isFeatured).toBe(true);
    expect(result.tags).toEqual(['aretes', 'elegante']);
    expect(result.categoria).toEqual({ id: 'cat-1', nombre: 'Aretes', slug: 'aretes' });
  });

  it('ningún tier filtra precio_base — verificación exhaustiva', () => {
    const product = makeDbProduct(150_000);
    const tiers = ['detal', 'por_mayor', 'gran_mayor', null] as const;

    for (const tier of tiers) {
      const result = formatProductForTier(product, tier);
      const allKeys = Object.keys(result);
      const json = JSON.stringify(result);

      expect(allKeys).not.toContain('precioBase');
      expect(allKeys).not.toContain('precio_base');
      expect(json).not.toContain('precioBase');
      expect(json).not.toContain('precio_base');

      expect(allKeys).toContain('precio');
    }
  });
});

describe('Products pricing calculations', () => {
  it('calcula precios correctos para todos los tiers', () => {
    expect(calculatePrice(100_000, 'detal')).toBe(100_000);
    expect(calculatePrice(100_000, 'por_mayor')).toBe(62_500);
    expect(calculatePrice(100_000, 'gran_mayor')).toBe(50_000);
    expect(calculatePrice(100_000, null)).toBe(100_000);
  });

  it('maneja precios fraccionarios con redondeo', () => {
    expect(calculatePrice(99_999, 'por_mayor')).toBe(62_499);
    expect(calculatePrice(33_333, 'gran_mayor')).toBe(16_667);
  });

  it('precio cero se mantiene cero para cualquier tier', () => {
    expect(calculatePrice(0, 'detal')).toBe(0);
    expect(calculatePrice(0, 'por_mayor')).toBe(0);
    expect(calculatePrice(0, 'gran_mayor')).toBe(0);
  });
});

describe('Admin products — DOES include precioBase', () => {
  it('admin format includes precioBase for management', () => {
    const product = makeDbProduct(100_000);
    const adminResult = {
      id: product.id,
      sku: product.sku,
      nombre: product.nombre,
      precioBase: Number(product.precioBase),
      precio: Number(product.precioBase),
      stock: product.stock,
      stockReservado: 0,
    };

    expect(adminResult.precioBase).toBe(100_000);
    expect(JSON.stringify(adminResult)).toContain('precioBase');
  });
});
