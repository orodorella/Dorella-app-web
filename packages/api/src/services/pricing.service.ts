import type { Tier } from 'shared/src/types/user.js';
import { TIER_CONFIG } from 'shared/src/constants/tiers.js';
import type { Decimal } from '@prisma/client/runtime/library';

export function calculatePrice(precioBase: number, tier: Tier | null): number {
  const discount = tier ? TIER_CONFIG[tier].descuento : 0;
  return Math.round(precioBase * (1 - discount));
}

interface DbProduct {
  id: string;
  sku: string;
  nombre: string;
  descripcion: string | null;
  precioBase: Decimal;
  imagenes: unknown;
  material: string | null;
  stock: number;
  isFeatured: boolean;
  tags: string[];
  category: { id: string; nombre: string; slug: string };
}

export function formatProductForTier(product: DbProduct, tier: Tier | null) {
  const precio = calculatePrice(Number(product.precioBase), tier);
  return {
    id: product.id,
    sku: product.sku,
    nombre: product.nombre,
    descripcion: product.descripcion,
    precio,
    imagenes: product.imagenes as string[],
    material: product.material,
    stock: product.stock,
    isFeatured: product.isFeatured,
    tags: product.tags,
    categoria: product.category,
  };
}

export interface OrderLineItem {
  precioBase: number;
  cantidad: number;
}

export function calculateOrderTotal(items: OrderLineItem[], tier: Tier): number {
  return items.reduce((sum, item) => {
    return sum + calculatePrice(item.precioBase, tier) * item.cantidad;
  }, 0);
}

interface MinimumValidation {
  cumple: boolean;
  faltante: number;
  tierActual: { nombre: string; descuento: number; minimo: number };
  tierSiguiente: { nombre: string; descuento: number; minimo: number } | null;
}

const TIER_ORDER: Tier[] = ['detal', 'por_mayor', 'gran_mayor'];

export function validateMinimum(total: number, tier: Tier): MinimumValidation {
  const config = TIER_CONFIG[tier];
  const cumple = total >= config.minimo;
  const faltante = cumple ? 0 : config.minimo - total;

  const currentIndex = TIER_ORDER.indexOf(tier);
  const nextTierKey = currentIndex < TIER_ORDER.length - 1 ? TIER_ORDER[currentIndex + 1] : null;
  const tierSiguiente = nextTierKey
    ? { nombre: TIER_CONFIG[nextTierKey].label, descuento: TIER_CONFIG[nextTierKey].descuento, minimo: TIER_CONFIG[nextTierKey].minimo }
    : null;

  return {
    cumple,
    faltante,
    tierActual: { nombre: config.label, descuento: config.descuento, minimo: config.minimo },
    tierSiguiente,
  };
}
