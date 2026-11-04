'use client';

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatInt, formatMoney, formatMoneyCompact } from '@/lib/format';
import { CHART_AXIS_TICK, CHART_GRID } from '@/components/admin/styles';

interface CategoryRow {
  category: string;
  units: number;
  revenue: number;
}

interface Props {
  data: CategoryRow[];
  days: number;
}

const PALETTE = ['#5B0E16', '#C9A84C', '#8b5cf6', '#06b6d4', '#f59e0b', '#22c55e', '#ef4444', '#d6d3d1'];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CategoryRow }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-stone-100 p-3 text-xs">
      <p className="font-semibold text-stone-800 mb-1">{d.category}</p>
      <p className="text-wine font-medium">{formatMoney(d.revenue)}</p>
      <p className="text-stone-600">{formatInt(d.units)} unidades</p>
    </div>
  );
}

export default function SalesByCategoryChart({ data, days }: Props) {
  const chartData = [...data].reverse().map((c) => ({
    ...c,
    shortName: c.category.length > 18 ? c.category.slice(0, 18) + '…' : c.category,
  }));

  return (
    <div>
      <h3 className="text-base font-semibold text-stone-800 mb-4">Ventas confirmadas por categoría ({days} días)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          <XAxis type="number" tick={CHART_AXIS_TICK} tickFormatter={(v) => formatMoneyCompact(Number(v))} />
          <YAxis type="category" dataKey="shortName" width={140} tick={CHART_AXIS_TICK} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={18}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
