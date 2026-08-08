'use client';

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCOP } from '@/lib/api-client';

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
      <p className="text-wine font-medium">{formatCOP(d.revenue)}</p>
      <p className="text-stone-400">{d.units} unidades</p>
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
      <h3 className="text-sm font-semibold text-stone-700 mb-4">Ventas por Categoría ({days} días)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
          <XAxis type="number" tick={{ fontSize: 10, fill: '#a8a29e' }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <YAxis type="category" dataKey="shortName" width={140} tick={{ fontSize: 11, fill: '#57534e' }} />
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
