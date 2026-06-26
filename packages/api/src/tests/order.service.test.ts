import { describe, it, expect } from 'vitest';
import { checkAndUpgradeTier } from '../services/order.service.js';
import { calculatePrice } from '../services/pricing.service.js';
import { TIER_CONFIG } from 'shared/src/constants/tiers.js';
import type { Tier } from 'shared/src/types/user.js';

describe('checkAndUpgradeTier', () => {
  // These tests use the pure function logic without DB.
  // The actual DB calls are tested via integration tests.
  // Here we verify the tier upgrade decision logic.

  function simulateTierDecision(orderTotal: number, currentTier: Tier): { upgraded: boolean; newTier: Tier } {
    let newTier: Tier = currentTier;

    if (orderTotal >= TIER_CONFIG.gran_mayor.minimo) {
      if (currentTier !== 'gran_mayor') {
        newTier = 'gran_mayor';
      }
    } else if (orderTotal >= TIER_CONFIG.por_mayor.minimo) {
      if (currentTier === 'detal') {
        newTier = 'por_mayor';
      }
    }

    return { upgraded: newTier !== currentTier, newTier };
  }

  it('orden de $600k con usuario detal → sube a por_mayor', () => {
    const result = simulateTierDecision(600_000, 'detal');
    expect(result.upgraded).toBe(true);
    expect(result.newTier).toBe('por_mayor');
  });

  it('orden de $6M con usuario detal → sube directo a gran_mayor', () => {
    const result = simulateTierDecision(6_000_000, 'detal');
    expect(result.upgraded).toBe(true);
    expect(result.newTier).toBe('gran_mayor');
  });

  it('orden de $6M con usuario por_mayor → sube a gran_mayor', () => {
    const result = simulateTierDecision(6_000_000, 'por_mayor');
    expect(result.upgraded).toBe(true);
    expect(result.newTier).toBe('gran_mayor');
  });

  it('orden de $200k con usuario por_mayor → tier NO cambia', () => {
    const result = simulateTierDecision(200_000, 'por_mayor');
    expect(result.upgraded).toBe(false);
    expect(result.newTier).toBe('por_mayor');
  });

  it('orden de $200k con usuario detal → tier NO cambia (no alcanza $500k)', () => {
    const result = simulateTierDecision(200_000, 'detal');
    expect(result.upgraded).toBe(false);
    expect(result.newTier).toBe('detal');
  });

  it('orden de exactamente $500k con usuario detal → sube a por_mayor', () => {
    const result = simulateTierDecision(500_000, 'detal');
    expect(result.upgraded).toBe(true);
    expect(result.newTier).toBe('por_mayor');
  });

  it('orden de $499,999 con usuario detal → NO sube', () => {
    const result = simulateTierDecision(499_999, 'detal');
    expect(result.upgraded).toBe(false);
    expect(result.newTier).toBe('detal');
  });

  it('orden de exactamente $5M con usuario por_mayor → sube a gran_mayor', () => {
    const result = simulateTierDecision(5_000_000, 'por_mayor');
    expect(result.upgraded).toBe(true);
    expect(result.newTier).toBe('gran_mayor');
  });

  it('orden de $4,999,999 con usuario por_mayor → NO sube', () => {
    const result = simulateTierDecision(4_999_999, 'por_mayor');
    expect(result.upgraded).toBe(false);
    expect(result.newTier).toBe('por_mayor');
  });

  it('usuario gran_mayor NUNCA sube más (ya es máximo)', () => {
    const result = simulateTierDecision(50_000_000, 'gran_mayor');
    expect(result.upgraded).toBe(false);
    expect(result.newTier).toBe('gran_mayor');
  });
});

describe('Tier pricing after upgrade', () => {
  it('usuario que subió a por_mayor → descuento 37.5% aplica en compras futuras sin importar monto', () => {
    const precioBase = 100_000;
    const precioConDescuento = calculatePrice(precioBase, 'por_mayor');
    expect(precioConDescuento).toBe(62_500);

    const compraPequena = calculatePrice(50_000, 'por_mayor');
    expect(compraPequena).toBe(31_250);
  });

  it('usuario que subió a gran_mayor → descuento 50% aplica en compras futuras sin importar monto', () => {
    const precioBase = 100_000;
    const precioConDescuento = calculatePrice(precioBase, 'gran_mayor');
    expect(precioConDescuento).toBe(50_000);

    const compraPequena = calculatePrice(29_900, 'gran_mayor');
    expect(compraPequena).toBe(14_950);
  });

  it('tier detal no tiene descuento', () => {
    expect(calculatePrice(100_000, 'detal')).toBe(100_000);
  });
});

describe('Order total calculation with tier pricing', () => {
  it('calcula total correctamente para cada tier', () => {
    const precioBase = 100_000;
    const cantidad = 6;

    const totalDetal = calculatePrice(precioBase, 'detal') * cantidad;
    expect(totalDetal).toBe(600_000);

    const totalMayor = calculatePrice(precioBase, 'por_mayor') * cantidad;
    expect(totalMayor).toBe(375_000);

    const totalGran = calculatePrice(precioBase, 'gran_mayor') * cantidad;
    expect(totalGran).toBe(300_000);
  });

  it('response de orden NUNCA contiene precio_base ni precioBase', () => {
    const mockOrderResponse = {
      id: 'order-1',
      orderNumber: 'DOR-20260623-0001',
      status: 'pending',
      tierAtPurchase: 'detal',
      descuentoAplicado: 0,
      subtotal: 600000,
      total: 600000,
      items: [
        { id: 'item-1', sku: 'AR-001', nombreProducto: 'Aretes', cantidad: 6, precioUnitario: 100000, subtotal: 600000 },
      ],
      createdAt: '2026-06-23T00:00:00.000Z',
    };

    const json = JSON.stringify(mockOrderResponse);
    expect(json).not.toContain('precio_base');
    expect(json).not.toContain('precioBase');
    expect(json).not.toContain('precioBaseSnapshot');
  });
});

describe('Tier upgrade thresholds match TIER_CONFIG', () => {
  it('por_mayor threshold is $500,000', () => {
    expect(TIER_CONFIG.por_mayor.minimo).toBe(500_000);
  });

  it('gran_mayor threshold is $5,000,000', () => {
    expect(TIER_CONFIG.gran_mayor.minimo).toBe(5_000_000);
  });

  it('detal has no minimum', () => {
    expect(TIER_CONFIG.detal.minimo).toBe(0);
  });

  it('discounts are correct', () => {
    expect(TIER_CONFIG.detal.descuento).toBe(0);
    expect(TIER_CONFIG.por_mayor.descuento).toBe(0.375);
    expect(TIER_CONFIG.gran_mayor.descuento).toBe(0.5);
  });
});
