'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Product {
  productId: string;
  nombre: string;
  stock: number;
  daysOfInventory: number | null;
  averageDaily: number;
}

interface Props {
  data: Product[];
}

function getColor(days: number | null): string {
  if (days === null) return '#d6d3d1';
  if (days < 3) return '#ef4444';
  if (days < 7) return '#f59e0b';
  if (days < 14) return '#C9A84C';
  return '#22c55e';
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Product }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-stone-100 p-3 text-xs">
      <p className="font-semibold text-stone-800 mb-1">{p.nombre}</p>
      <p className="text-stone-500">Stock: {p.stock} unidades</p>
      <p className="text-stone-500">Venta: {p.averageDaily}/día</p>
      <p className="font-medium mt-1" style={{ color: getColor(p.daysOfInventory) }}>
        {p.daysOfInventory !== null ? `${p.daysOfInventory} días restantes` : 'Sin datos de venta'}
      </p>
    </div>
  );
}

export default function StockDaysChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-64 text-stone-400 text-sm">Sin datos de inventario</div>;
  }

  const sorted = [...data]
    .filter((p) => p.daysOfInventory !== null)
    .sort((a, b) => (a.daysOfInventory ?? 999) - (b.daysOfInventory ?? 999))
    .slice(0, 10);

  return (
    <div>
      <h3 className="text-sm font-semibold text-stone-700 mb-4">Días de Inventario Restantes</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: '#a8a29e' }} />
          <YAxis type="category" dataKey="nombre" width={120} tick={{ fontSize: 10, fill: '#78716c' }} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="daysOfInventory" radius={[0, 4, 4, 0]} barSize={18}>
            {sorted.map((p) => (
              <Cell key={p.productId} fill={getColor(p.daysOfInventory)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
