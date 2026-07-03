import type { PricingItemMock } from '@/mocks/pricing-items';

export const GRAN_MAYOR_FACTOR = 0.8;
export const DETAL_DIVISOR = 0.5;

export interface CalculatorSelection extends PricingItemMock {
  cantidad: number;
}

export interface AdditionalCosts {
  costoTejida: number;
  costoHerrajes: number;
  costoAccesorios: number;
  costoEmpaque: number;
}

export interface CalculatedPricingRow extends CalculatorSelection {
  subtotal: number;
}

export interface PricingCalculationResult {
  rows: CalculatedPricingRow[];
  costoBalines: number;
  costoPorMayor: number;
  precioGranMayor: number;
  precioVentaDetal: number;
  precioPorMayor: number;
  gananciaEstimadaDetal: number;
}

export function calculatePricingRows(items: CalculatorSelection[]): CalculatedPricingRow[] {
  return items.map((item) => ({
    ...item,
    subtotal: item.cantidad * item.unitCost,
  }));
}

export function calculatePricing(
  items: CalculatorSelection[],
  additionalCosts: AdditionalCosts,
): PricingCalculationResult {
  const rows = calculatePricingRows(items);
  const costoBalines = rows.reduce((sum, item) => sum + item.subtotal, 0);
  const costoPorMayor = costoBalines
    + additionalCosts.costoTejida
    + additionalCosts.costoHerrajes
    + additionalCosts.costoAccesorios
    + additionalCosts.costoEmpaque;
  const precioGranMayor = costoPorMayor * GRAN_MAYOR_FACTOR;
  const precioVentaDetal = precioGranMayor / DETAL_DIVISOR;
  const precioPorMayor = costoPorMayor;
  const gananciaEstimadaDetal = precioVentaDetal - costoPorMayor;

  return {
    rows,
    costoBalines,
    costoPorMayor,
    precioGranMayor,
    precioVentaDetal,
    precioPorMayor,
    gananciaEstimadaDetal,
  };
}
