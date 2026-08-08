'use client';

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCOP } from '@/lib/api-client';

const TIER_LABELS: Record<string, string> = { detal: 'Detal', por_mayor: 'Por Mayor', gran_mayor: 'Gran Mayor' };
const TIER_COLORS: Record<string, string> = { detal: '#a8a29e', por_mayor: '#C9A84C', gran_mayor: '#5B0E16' };
const TIERS = ['detal', 'por_mayor', 'gran_mayor'];

interface TierRow {
  tier: string;
  revenue: number;
  orders: number;
  aov: number;
  discount: number;
}

interface Props {
  data: TierRow[];
  days: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TierRow }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-stone-100 p-3 text-xs">
      <p className="font-semibold text-stone-800 mb-1">{TIER_LABELS[d.tier] || d.tier}</p>
      <p className="text-wine font-medium">{formatCOP(d.revenue)}</p>
      <p className="text-stone-500">{d.orders} órdenes · ticket {formatCOP(d.aov)}</p>
      {d.discount > 0 && <p className="text-stone-400">Descuento aplicado: {formatCOP(d.discount)}</p>}
    </div>
  );
}

export default function RevenueByTierChart({ data, days }: Props) {
  const chartData = TIERS.map((tier) => data.find((d) => d.tier === tier) ?? { tier, revenue: 0, orders: 0, aov: 0, discount: 0 });

  return (
    <div>
      <h3 className="text-sm font-semibold text-stone-700 mb-4">Ingresos por Tier ({days} días)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
          <XAxis dataKey="tier" tick={{ fontSize: 11, fill: '#a8a29e' }} tickFormatter={(t) => TIER_LABELS[t] || t} />
          <YAxis tick={{ fontSize: 10, fill: '#a8a29e' }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={(value: string) => <span className="text-xs text-stone-600">{value === 'revenue' ? 'Ingresos' : value}</span>} />
          <Bar dataKey="revenue" name="Ingresos" radius={[4, 4, 0, 0]}>
            {chartData.map((d) => (
              <Cell key={d.tier} fill={TIER_COLORS[d.tier] || '#d6d3d1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
