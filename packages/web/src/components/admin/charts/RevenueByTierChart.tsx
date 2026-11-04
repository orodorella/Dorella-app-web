'use client';

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatInt, formatMoney, formatMoneyCompact } from '@/lib/format';
import { CHART_AXIS_TICK, CHART_GRID } from '@/components/admin/styles';

const TIER_LABELS: Record<string, string> = { detal: 'Detal', por_mayor: 'Por mayor', gran_mayor: 'Gran mayor' };
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
      <p className="text-wine font-medium">{formatMoney(d.revenue)}</p>
      <p className="text-stone-600">{formatInt(d.orders)} órdenes · ticket {formatMoney(d.aov)}</p>
      {d.discount > 0 && <p className="text-stone-600">Descuento aplicado: {formatMoney(d.discount)}</p>}
    </div>
  );
}

export default function RevenueByTierChart({ data, days }: Props) {
  const chartData = TIERS.map((tier) => data.find((d) => d.tier === tier) ?? { tier, revenue: 0, orders: 0, aov: 0, discount: 0 });

  return (
    <div>
      <h3 className="text-base font-semibold text-stone-800 mb-4">Ventas confirmadas por modalidad ({days} días)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          <XAxis dataKey="tier" tick={CHART_AXIS_TICK} tickFormatter={(t) => TIER_LABELS[t] || t} />
          <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => formatMoneyCompact(Number(v))} />
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={(value: string) => <span className="text-xs text-stone-600">{value === 'revenue' ? 'Ventas confirmadas' : value}</span>} />
          <Bar dataKey="revenue" name="Ventas confirmadas" radius={[4, 4, 0, 0]}>
            {chartData.map((d) => (
              <Cell key={d.tier} fill={TIER_COLORS[d.tier] || '#d6d3d1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
