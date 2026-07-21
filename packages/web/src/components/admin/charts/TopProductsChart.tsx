'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Image from 'next/image';
import { formatCOP } from '@/lib/api-client';

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
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Product }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-stone-100 p-3 text-xs">
      <p className="font-semibold text-stone-800 mb-1">{p.nombre}</p>
      <p className="text-stone-500">SKU: {p.sku}</p>
      <p className="text-wine font-medium mt-1">{p.totalSold} unidades vendidas</p>
      <p className="text-stone-400">{p.averageDaily}/día promedio</p>
      {p.totalRevenue > 0 && (
        <>
          <div className="border-t border-stone-100 my-1.5" />
          <p className="text-emerald-600 font-medium">{formatCOP(p.totalRevenue)} en ingresos</p>
          <p className="text-stone-400">{formatCOP(p.averageDailyRevenue)}/día</p>
        </>
      )}
    </div>
  );
}

export default function TopProductsChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-64 text-stone-400 text-sm">Sin ventas en los últimos 30 días</div>;
  }

  const chartData = data.map((p) => ({ ...p, shortName: p.nombre.length > 15 ? p.nombre.slice(0, 15) + '…' : p.nombre }));

  return (
    <div>
      <h3 className="text-sm font-semibold text-stone-700 mb-4">Top Productos Vendidos (30 días)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 25, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
          <XAxis dataKey="shortName" tick={{ fontSize: 10, fill: '#a8a29e' }} angle={-35} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 10, fill: '#a8a29e' }} />
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
          <div key={p.productId} className="flex items-center gap-2 text-[10px] text-stone-500">
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
