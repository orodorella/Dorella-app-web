'use client';

import { ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDate, formatDayMonth, formatInt, formatMoney, formatMoneyCompact } from '@/lib/format';
import { CHART_AXIS_TICK, CHART_GRID } from '@/components/admin/styles';

interface TimelinePoint {
  date: string;
  revenue: number;
  orders: number;
}

interface Props {
  data: TimelinePoint[];
  days: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TimelinePoint }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-stone-100 p-3 text-xs">
      <p className="text-stone-600">{formatDate(d.date)}</p>
      <p className="text-wine font-semibold mt-1">{formatMoney(d.revenue)}</p>
      <p className="text-stone-600">{formatInt(d.orders)} órdenes</p>
    </div>
  );
}

export default function RevenueTimelineChart({ data, days }: Props) {
  return (
    <div>
      <h3 className="text-base font-semibold text-stone-800 mb-4">Ventas confirmadas por día ({days} días)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5B0E16" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#5B0E16" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          <XAxis dataKey="date" tick={CHART_AXIS_TICK} tickFormatter={(d) => formatDayMonth(String(d))} minTickGap={16} />
          <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => formatMoneyCompact(Number(v))} />
          <YAxis yAxisId="right" orientation="right" hide />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="orders" fill="#d6d3d1" radius={[3, 3, 0, 0]} barSize={8} yAxisId="right" />
          <Area type="monotone" dataKey="revenue" stroke="#5B0E16" fill="url(#revenueGradient)" strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
