'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { formatInt } from '@/lib/format';

interface OperationalData {
  inventory: {
    totalActiveProducts: number;
    outOfStock: number;
    lowStock: number;
    totalUnits: number;
    totalReserved: number;
  };
  ordersByStatus: Array<{ status: string; count: number }>;
  lowStock: Array<{ id: string; sku: string; nombre: string; stock: number; stockMinimo: number }>;
  ordersToPrepare: Array<{ id: string; orderNumber: string; status: string; paymentStatus: string | null; createdAt: string; units: number }>;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmado', invoiced: 'Facturado',
  shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado',
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-2 text-2xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>{formatInt(value)}</p>
    </div>
  );
}

/** Tablero para bodega: inventario y pedidos por preparar, sin cifras de venta. */
export default function OperationalDashboard() {
  const [data, setData] = useState<OperationalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request('GET', '/api/admin/dashboard/operational')
      .then((res) => {
        if (res.success) setData(res.data as OperationalData);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-wine" /></div>;
  }
  if (!data) return <p className="py-20 text-center text-sm text-stone-500">No se pudo cargar el tablero.</p>;

  return (
    <div>
      <h1 className="mb-1 text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Tablero operativo</h1>
      <p className="mb-6 text-sm text-stone-500">Inventario y pedidos por preparar</p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Productos activos" value={data.inventory.totalActiveProducts} />
        <Stat label="Agotados" value={data.inventory.outOfStock} />
        <Stat label="Stock bajo" value={data.inventory.lowStock} />
        <Stat label="Unidades en bodega" value={data.inventory.totalUnits} />
        <Stat label="Unidades reservadas" value={data.inventory.totalReserved} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-stone-700">Pedidos por preparar</h2>
          {data.ordersToPrepare.length === 0 ? (
            <p className="text-sm text-stone-500">No hay pedidos pendientes.</p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {data.ordersToPrepare.map((order) => (
                <li key={order.id} className="flex items-center justify-between py-2">
                  <span className="font-medium text-stone-700">{order.orderNumber}</span>
                  <span className="text-stone-500">{STATUS_LABELS[order.status] ?? order.status} · {order.units} u.</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-stone-700">Reposición necesaria</h2>
          {data.lowStock.length === 0 ? (
            <p className="text-sm text-stone-500">Sin alertas de stock.</p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {data.lowStock.map((product) => (
                <li key={product.id} className="flex items-center justify-between py-2">
                  <span className="truncate pr-3 text-stone-700">{product.nombre} <span className="text-stone-500">({product.sku})</span></span>
                  <span className="whitespace-nowrap text-stone-500">{product.stock} / mín. {product.stockMinimo}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-stone-700">Pedidos por estado (últimos 30 días)</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          {data.ordersByStatus.map((row) => (
            <span key={row.status} className="rounded-full bg-stone-100 px-3 py-1 text-stone-600">
              {STATUS_LABELS[row.status] ?? row.status}: <strong>{row.count}</strong>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
