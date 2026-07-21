'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCOP } from '@/lib/api-client';

interface Props {
  data: Array<{ date: string; revenue: number }>;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { date: string; revenue: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-stone-100 p-3 text-xs">
      <p className="text-stone-500">{d.date}</p>
      <p className="text-wine font-semibold mt-1">{formatCOP(d.revenue)}</p>
    </div>
  );
}

export default function RevenueTimelineChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-64 text-stone-400 text-sm">Sin ingresos en los últimos 30 días</div>;
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-stone-700 mb-4">Revenue Últimos 30 Días</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5B0E16" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#5B0E16" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#a8a29e' }} />
          <YAxis tick={{ fontSize: 10, fill: '#a8a29e' }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="revenue" stroke="#5B0E16" fill="url(#revenueGradient)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
