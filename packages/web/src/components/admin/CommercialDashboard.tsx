'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { formatInt, formatMoney, formatAge } from '@/lib/format';

interface OrderPreview {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  total: number;
  cliente: string;
}

interface CommercialData {
  porCobrar: { data: OrderPreview[]; total: number; moreCount: number };
  enProceso: { data: OrderPreview[]; total: number; moreCount: number };
}

interface ProductAvailability {
  id: string;
  sku: string;
  nombre: string;
  disponible: number;
  stock: number;
  stockReservado: number;
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmado', preparado: 'Preparado', shipped: 'Enviado',
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-2 text-2xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>{formatInt(value)}</p>
    </div>
  );
}

function OrderList({ title, orders, moreCount, emptyText }: { title: string; orders: OrderPreview[]; moreCount: number; emptyText: string }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-stone-700">{title}</h2>
      {orders.length === 0 ? (
        <p className="text-sm text-stone-500">{emptyText}</p>
      ) : (
        <>
          <ul className="divide-y divide-stone-100 text-sm">
            {orders.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium text-stone-700">{order.orderNumber}</p>
                  <p className="truncate text-xs text-stone-500">{order.cliente}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium text-stone-700">{formatMoney(order.total)}</p>
                  <p className="text-xs text-stone-500">
                    {STATUS_LABELS[order.status] ? `${STATUS_LABELS[order.status]} · ` : ''}{formatAge(order.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {moreCount > 0 ? <p className="mt-2 text-xs text-stone-500">+{moreCount} más</p> : null}
        </>
      )}
    </section>
  );
}

/**
 * Tablero del comercial: solo sus propios pedidos (sellerId en el backend) y
 * un buscador de disponibilidad. Sin cifras financieras, costos ni márgenes,
 * ni datos de otros comerciales.
 */
export default function CommercialDashboard() {
  const [data, setData] = useState<CommercialData | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<ProductAvailability[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    request('GET', '/api/admin/dashboard/commercial')
      .then((res) => {
        if (res.success) setData(res.data as CommercialData);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setProducts([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      request('GET', `/api/admin/orders/lookup/products?search=${encodeURIComponent(term)}&pageSize=10`)
        .then((res) => { if (res.success) setProducts(res.data as ProductAvailability[]); })
        .catch(() => setProducts([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-wine" /></div>;
  }
  if (!data) return <p className="py-20 text-center text-sm text-stone-500">No se pudo cargar el tablero.</p>;

  return (
    <div>
      <h1 className="mb-1 text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Mi tablero</h1>
      <p className="mb-6 text-sm text-stone-500">Tus pedidos y disponibilidad de productos</p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Por cobrar" value={data.porCobrar.total} />
        <Stat label="En proceso" value={data.enProceso.total} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <OrderList title="Mis pedidos por cobrar" orders={data.porCobrar.data} moreCount={data.porCobrar.moreCount} emptyText="No tienes pedidos pendientes de pago." />
        <OrderList title="Mis pedidos en proceso" orders={data.enProceso.data} moreCount={data.enProceso.moreCount} emptyText="No tienes pedidos pagados en camino." />
      </div>

      <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-stone-700">Disponibilidad de productos</h2>
        <div className="relative max-w-md">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o SKU…"
            className="w-full rounded-lg border border-stone-300 py-2 pl-9 pr-3 text-sm focus:border-wine focus:outline-none"
          />
        </div>
        {searching ? <p className="mt-3 text-sm text-stone-500">Buscando…</p> : null}
        {!searching && search.trim().length >= 2 && products.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Sin resultados.</p>
        ) : null}
        {products.length > 0 ? (
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
            {products.map((product) => (
              <li key={product.id} className="flex items-center justify-between py-2">
                <span className="truncate pr-3 text-stone-700">{product.nombre} <span className="text-stone-500">({product.sku})</span></span>
                <span className={`whitespace-nowrap font-medium ${product.disponible > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatInt(product.disponible)} disponibles
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
