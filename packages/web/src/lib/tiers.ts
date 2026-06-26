export const TIERS: Record<string, { label: string; descuento: number; minimo: number }> = {
  detal: { label: 'Detal / Visitante', descuento: 0, minimo: 0 },
  mayorista: { label: 'Por Mayor', descuento: 0.375, minimo: 500000 },
  granmayorista: { label: 'Gran Mayor', descuento: 0.5, minimo: 5000000 },
};

export type TierKey = keyof typeof TIERS;

export function getTierInfo(tier: string) {
  return TIERS[tier] || TIERS.detal;
}
