import type { Tier } from '../types/user.js';

export interface TierConfig {
  label: string;
  descuento: number;
  minimo: number;
}

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  detal: { label: 'Detal / Visitante', descuento: 0, minimo: 0 },
  por_mayor: { label: 'Por Mayor', descuento: 0.375, minimo: 500_000 },
  gran_mayor: { label: 'Gran Mayor', descuento: 0.5, minimo: 5_000_000 },
};
