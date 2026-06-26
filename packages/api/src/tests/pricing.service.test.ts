import { describe, it, expect } from 'vitest';
import { calculatePrice, formatProductForTier, validateMinimum, calculateOrderTotal } from '../services/pricing.service.js';
import type { Decimal } from '@prisma/client/runtime/library';

function makeDecimal(value: number): Decimal {
  return { toNumber: () => value, toString: () => String(value) } as unknown as Decimal;
}

function makeDbProduct(precioBase: number) {
  return {
    id: 'test-id',
    sku: 'SKU-001',
    nombre: 'Anillo Test',
    descripcion: 'Un anillo de prueba',
    precioBase: makeDecimal(precioBase),
    imagenes: ['img1.webp'],
    material: 'Oro laminado 18k',
    stock: 50,
    isFeatured: false,
    tags: ['anillos'],
    category: { id: 'cat-1', nombre: 'Anillos', slug: 'anillos' },
  };
}

describe('calculatePrice', () => {
  it('aplica 0% descuento para tier detal', () => {
    expect(calculatePrice(100_000, 'detal')).toBe(100_000);
  });

  it('aplica 37.5% descuento para tier por_mayor', () => {
    expect(calculatePrice(100_000, 'por_mayor')).toBe(62_500);
  });

  it('aplica 50% descuento para tier gran_mayor', () => {
    expect(calculatePrice(100_000, 'gran_mayor')).toBe(50_000);
  });

  it('aplica 0% descuento cuando tier es null (usuario no autenticado)', () => {
    expect(calculatePrice(100_000, null)).toBe(100_000);
  });

  it('redondea correctamente precios fraccionarios', () => {
    expect(calculatePrice(99_999, 'por_mayor')).toBe(62_499);
  });
});

describe('formatProductForTier', () => {
  it('NUNCA devuelve precio_base ni precioBase', () => {
    const product = makeDbProduct(100_000);

    const resultDetal = formatProductForTier(product, 'detal');
    const resultMayor = formatProductForTier(product, 'por_mayor');
    const resultGran = formatProductForTier(product, 'gran_mayor');
    const resultNull = formatProductForTier(product, null);

    for (const result of [resultDetal, resultMayor, resultGran, resultNull]) {
      const json = JSON.stringify(result);
      expect(json).not.toContain('precio_base');
      expect(json).not.toContain('precioBase');
      expect(Object.keys(result)).not.toContain('precioBase');
      expect(Object.keys(result)).not.toContain('precio_base');
    }
  });

  it('devuelve precio calculado según tier', () => {
    const product = makeDbProduct(100_000);
    expect(formatProductForTier(product, 'detal').precio).toBe(100_000);
    expect(formatProductForTier(product, 'por_mayor').precio).toBe(62_500);
    expect(formatProductForTier(product, 'gran_mayor').precio).toBe(50_000);
  });

  it('incluye todos los campos públicos', () => {
    const product = makeDbProduct(100_000);
    const result = formatProductForTier(product, 'detal');
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('sku');
    expect(result).toHaveProperty('nombre');
    expect(result).toHaveProperty('precio');
    expect(result).toHaveProperty('imagenes');
    expect(result).toHaveProperty('categoria');
  });
});

describe('calculateOrderTotal', () => {
  it('calcula el total correctamente para por_mayor', () => {
    const items = [
      { precioBase: 100_000, cantidad: 2 },
      { precioBase: 50_000, cantidad: 3 },
    ];
    // por_mayor: (100000*0.625)*2 + (50000*0.625)*3 = 125000 + 93750 = 218750
    expect(calculateOrderTotal(items, 'por_mayor')).toBe(218_750);
  });

  it('calcula el total sin descuento para detal', () => {
    const items = [{ precioBase: 80_000, cantidad: 1 }];
    expect(calculateOrderTotal(items, 'detal')).toBe(80_000);
  });
});

describe('validateMinimum', () => {
  it('detal siempre cumple (mínimo $0)', () => {
    const result = validateMinimum(0, 'detal');
    expect(result.cumple).toBe(true);
    expect(result.faltante).toBe(0);
  });

  it('por_mayor cumple con exactamente $500,000', () => {
    const result = validateMinimum(500_000, 'por_mayor');
    expect(result.cumple).toBe(true);
    expect(result.faltante).toBe(0);
  });

  it('por_mayor NO cumple con $499,999', () => {
    const result = validateMinimum(499_999, 'por_mayor');
    expect(result.cumple).toBe(false);
    expect(result.faltante).toBe(1);
  });

  it('gran_mayor cumple con exactamente $5,000,000', () => {
    const result = validateMinimum(5_000_000, 'gran_mayor');
    expect(result.cumple).toBe(true);
    expect(result.faltante).toBe(0);
  });

  it('gran_mayor NO cumple con $4,999,999', () => {
    const result = validateMinimum(4_999_999, 'gran_mayor');
    expect(result.cumple).toBe(false);
    expect(result.faltante).toBe(1);
  });

  it('devuelve tierSiguiente correcto para detal', () => {
    const result = validateMinimum(0, 'detal');
    expect(result.tierSiguiente).not.toBeNull();
    expect(result.tierSiguiente!.nombre).toBe('Por Mayor');
    expect(result.tierSiguiente!.descuento).toBe(0.375);
    expect(result.tierSiguiente!.minimo).toBe(500_000);
  });

  it('devuelve tierSiguiente correcto para por_mayor', () => {
    const result = validateMinimum(500_000, 'por_mayor');
    expect(result.tierSiguiente).not.toBeNull();
    expect(result.tierSiguiente!.nombre).toBe('Gran Mayor');
    expect(result.tierSiguiente!.minimo).toBe(5_000_000);
  });

  it('devuelve tierSiguiente null para gran_mayor (tier máximo)', () => {
    const result = validateMinimum(5_000_000, 'gran_mayor');
    expect(result.tierSiguiente).toBeNull();
  });
});
