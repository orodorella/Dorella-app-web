'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { formatInt, formatAge } from '@/lib/format';

interface OperationalData {
  inventory: {
    totalActiveProducts: number;
    outOfStock: number;
    lowStock: number;
    totalUnits: number;
    totalReserved: number;
  };
  ordersByStatus: Array<{ status: string; count: number }>;
  lowStock: Array<{ id: string; sku: string; nombre: string; stock: number; stockMinimo: number; unitsPending: number }>;
  ordersToPrepare: {
    data: Array<{ id: string; orderNumber: string; createdAt: string; units: number }>;
    total: number;
    moreCount: number;
  };
  cards: {
    toPrepare: number;
    preparedNotShipped: number;
    oldestUnshippedDays: number | null;
    outOfStockWithPendingOrders: number;
  };
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmado', preparado: 'Preparado', invoiced: 'Facturado',
  shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado',
};

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-2 text-2xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>{formatInt(value)}</p>
    </div>
  );
  if (!href) return body;
  return <Link href={href} className="block transition-opacity hover:opacity-80">{body}</Link>;
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

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Por preparar" value={data.cards.toPrepare} href="/admin/ordenes?status=confirmed" />
        <Stat label="Preparados sin despachar" value={data.cards.preparedNotShipped} href="/admin/ordenes?status=preparado" />
        <Stat label="Pedido más antiguo sin despachar" value={data.cards.oldestUnshippedDays ?? 0} />
        <Stat label="Agotados con pedidos pendientes" value={data.cards.outOfStockWithPendingOrders} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-700">Por preparar</h2>
            <Link href="/admin/ordenes?status=confirmed" className="text-xs font-medium text-wine hover:underline">Ver en Órdenes →</Link>
          </div>
          {data.ordersToPrepare.data.length === 0 ? (
            <p className="text-sm text-stone-500">No hay pedidos por preparar.</p>
          ) : (
            <>
              <ul className="divide-y divide-stone-100 text-sm">
                {data.ordersToPrepare.data.map((order) => (
                  <li key={order.id} className="flex items-center justify-between py-2">
                    <span className="font-medium text-stone-700">{order.orderNumber}</span>
                    <span className="text-stone-500">{formatAge(order.createdAt)} · {order.units} u.</span>
                  </li>
                ))}
              </ul>
              {data.ordersToPrepare.moreCount > 0 ? (
                <p className="mt-2 text-xs text-stone-500">+{data.ordersToPrepare.moreCount} más</p>
              ) : null}
            </>
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
                  <span className="whitespace-nowrap text-stone-500">
                    {product.stock} / mín. {product.stockMinimo}
                    {product.unitsPending > 0 ? ` · ${product.unitsPending} pedidas` : ''}
                  </span>
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
