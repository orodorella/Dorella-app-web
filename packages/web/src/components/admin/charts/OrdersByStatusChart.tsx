'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  invoiced: '#8b5cf6',
  shipped: '#06b6d4',
  delivered: '#22c55e',
  cancelled: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  invoiced: 'Facturada',
  shipped: 'Enviada',
  delivered: 'Entregada',
  cancelled: 'Cancelada',
};

interface Props {
  data: Record<string, number>;
}

export default function OrdersByStatusChart({ data }: Props) {
  const entries = Object.entries(data).filter(([, count]) => count > 0);

  if (entries.length === 0) {
    return <div className="flex items-center justify-center h-64 text-stone-400 text-sm">Sin órdenes registradas</div>;
  }

  const chartData = entries.map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: count,
    status,
  }));

  return (
    <div>
      <h3 className="text-sm font-semibold text-stone-700 mb-4">Órdenes por Estado</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
            {chartData.map((entry) => (
              <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#d6d3d1'} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value: string) => <span className="text-xs text-stone-600">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
