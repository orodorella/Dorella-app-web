'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Image from 'next/image';
import { formatInt, formatMoney, formatNumber } from '@/lib/format';
import { CHART_AXIS_TICK, CHART_GRID } from '@/components/admin/styles';

interface Product {
  productId: string;
  sku: string;
  nombre: string;
  stock: number;
  imagenes: string[];
  totalSold: number;
  averageDaily: number;
  daysOfInventory: number | null;
  totalRevenue: number;
  averageDailyRevenue: number;
}

interface Props {
  data: Product[];
  days?: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Product }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-stone-100 p-3 text-xs">
      <p className="font-semibold text-stone-800 mb-1">{p.nombre}</p>
      <p className="text-stone-600">SKU: {p.sku}</p>
      <p className="text-wine font-medium mt-1">{formatInt(p.totalSold)} unidades vendidas</p>
      <p className="text-stone-600">{formatNumber(p.averageDaily)}/día promedio</p>
      {p.totalRevenue > 0 && (
        <>
          <div className="border-t border-stone-100 my-1.5" />
          <p className="text-emerald-700 font-medium">{formatMoney(p.totalRevenue)} en ventas</p>
          <p className="text-stone-600">{formatMoney(p.averageDailyRevenue)}/día</p>
        </>
      )}
    </div>
  );
}

export default function TopProductsChart({ data, days = 30 }: Props) {
  const chartData = data.map((p) => ({ ...p, shortName: p.nombre.length > 15 ? p.nombre.slice(0, 15) + '…' : p.nombre }));

  return (
    <div>
      <h3 className="text-base font-semibold text-stone-800 mb-4">Productos más vendidos ({days} días)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 25, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          <XAxis dataKey="shortName" tick={CHART_AXIS_TICK} angle={-35} textAnchor="end" height={60} />
          <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => formatInt(Number(v))} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="totalSold" radius={[4, 4, 0, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={i === 0 ? '#5B0E16' : i < 3 ? '#C9A84C' : '#d6d3d1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-2">
        {data.slice(0, 5).map((p) => (
          <div key={p.productId} className="flex items-center gap-2 text-xs text-stone-600">
            {p.imagenes?.[0] ? (
              <Image src={p.imagenes[0]} alt="" width={20} height={20} className="rounded object-cover" />
            ) : (
              <div className="w-5 h-5 rounded bg-stone-100" />
            )}
            <span className="truncate max-w-[100px]">{p.nombre}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
