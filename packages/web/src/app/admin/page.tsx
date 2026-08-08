'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { DollarSign, ShoppingBag, Clock, TrendingUp, Loader2, PackageSearch, Users, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import InventoryAlerts from '@/components/admin/charts/InventoryAlerts';
import TopProductsChart from '@/components/admin/charts/TopProductsChart';
import RevenueTimelineChart from '@/components/admin/charts/RevenueTimelineChart';
import StockDaysChart from '@/components/admin/charts/StockDaysChart';
import OrdersByStatusChart from '@/components/admin/charts/OrdersByStatusChart';
import RestockingTable from '@/components/admin/charts/RestockingTable';
import RevenueByTierChart from '@/components/admin/charts/RevenueByTierChart';
import SalesByCategoryChart from '@/components/admin/charts/SalesByCategoryChart';
import TopCustomersTable from '@/components/admin/charts/TopCustomersTable';
import TierUpgradesTable from '@/components/admin/charts/TierUpgradesTable';
import SlowMoversTable from '@/components/admin/charts/SlowMoversTable';

const STATUS_STYLES: Record<string, string> = { pending: 'bg-amber-50 text-amber-700', confirmed: 'bg-blue-50 text-blue-700', invoiced: 'bg-blue-50 text-blue-700', shipped: 'bg-purple-50 text-purple-700', delivered: 'bg-emerald-50 text-emerald-700', cancelled: 'bg-red-50 text-red-700' };
const STATUS_LABELS: Record<string, string> = { pending: 'Pendiente', confirmed: 'Confirmado', invoiced: 'Facturado', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado' };
const TIER_LABELS: Record<string, string> = { detal: 'Detal', por_mayor: 'Por Mayor', gran_mayor: 'Gran Mayor' };
const TIER_COLORS: Record<string, string> = { detal: 'bg-stone-100 text-stone-600', por_mayor: 'bg-gold/10 text-gold-dark border border-gold/20', gran_mayor: 'bg-wine/10 text-wine border border-wine/20' };

const RANGES = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
];

interface DashboardData {
  range: { days: number; start: string; prevStart: string; prevEnd: string };
  summary: { revenue: number; revenuePrev: number; revenueDeltaPct: number | null; orders: number; ordersPrev: number; ordersDeltaPct: number | null; aov: number; aovPrev: number; aovDeltaPct: number | null; pendingOrders: number; confirmedOrders: number };
  inventory: { totalActiveProducts: number; outOfStock: number; lowStock: number; totalUnits: number; totalReserved: number; inventoryValue: number; outOfStockProducts: Array<{ id: string; sku: string; nombre: string; imagenes: string[]; stock: number; stockMinimo: number }>; lowStockProducts: Array<{ id: string; sku: string; nombre: string; imagenes: string[]; stock: number; stockMinimo: number }>; healthyProducts: Array<{ id: string; sku: string; nombre: string; imagenes: string[]; stock: number; stockMinimo: number }> };
  customers: { total: number; newInRange: number; activeInRange: number };
  topProducts: Array<{ productId: string; sku: string; nombre: string; stock: number; imagenes: string[]; totalSold: number; averageDaily: number; daysOfInventory: number | null; totalRevenue: number; averageDailyRevenue: number }>;
  restockAlerts: Array<{ productId: string; sku: string; nombre: string; stock: number; imagenes: string[]; totalSold: number; averageDaily: number; daysOfInventory: number | null; totalRevenue: number; averageDailyRevenue: number }>;
  ordersByStatus: Record<string, number>;
  revenueTimeline: Array<{ date: string; revenue: number; orders: number }>;
  recentOrders: Array<{ id: string; orderNumber: string; status: string; total: number; tierAtPurchase: string; customerName: string; createdAt: string }>;
  revenueByTier: Array<{ tier: string; revenue: number; orders: number; aov: number; discount: number }>;
  salesByCategory: Array<{ category: string; units: number; revenue: number }>;
  topCustomers: Array<{ id: string; nombre: string; email: string; tier: string; orders: number; total: number; lastOrderAt: string }>;
  tierUpgrades: Array<{ email: string; nombre: string; oldTier: string; newTier: string; createdAt: string }>;
  slowMovers: Array<{ productId: string; sku: string; nombre: string; stock: number; stockMinimo: number; category: string }>;
}

function DeltaBadge({ current, previous, deltaPct, label }: { current: number; previous: number; deltaPct: number | null; label?: string }) {
  if (deltaPct === null) {
    if (current > 0 && previous <= 0) {
      return <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Nuevo</span>;
    }
    return <span className="text-[10px] text-stone-300 flex items-center gap-1"><Minus size={10} /> vs periodo anterior</span>;
  }
  const positive = deltaPct > 0;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${positive ? 'text-emerald-600 bg-emerald-50' : deltaPct < 0 ? 'text-red-600 bg-red-50' : 'text-stone-400 bg-stone-50'}`}>
      {positive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {Math.abs(deltaPct).toFixed(1)}% vs {label || 'anterior'}
    </span>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const requestId = useRef(0);

  const fetchData = useCallback(async (rangeDays: number) => {
    const id = ++requestId.current;
    try {
      const res = await request('GET', `/api/admin/dashboard?days=${rangeDays}`);
      if (id === requestId.current && res.success) setData(res.data);
    } catch {
      /* ignore */
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  if (loading && !data) {
    return <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-wine" /></div>;
  }

  const s = data?.summary;
  const inv = data?.inventory;
  const customers = data?.customers;
  const rangeLabel = `${days} días`;

  const kpis = [
    { label: `Ingresos (${rangeLabel})`, value: formatCOP(s?.revenue ?? 0), delta: { current: s?.revenue ?? 0, previous: s?.revenuePrev ?? 0, pct: s?.revenueDeltaPct ?? null }, icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Ticket Promedio', value: formatCOP(s?.aov ?? 0), delta: { current: s?.aov ?? 0, previous: s?.aovPrev ?? 0, pct: s?.aovDeltaPct ?? null }, icon: TrendingUp, color: 'text-wine bg-wine-50' },
    { label: `Órdenes (${rangeLabel})`, value: s?.orders ?? 0, delta: { current: s?.orders ?? 0, previous: s?.ordersPrev ?? 0, pct: s?.ordersDeltaPct ?? null }, icon: ShoppingBag, color: 'text-purple-600 bg-purple-50' },
    { label: 'Por confirmar', value: s?.pendingOrders ?? 0, icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { label: 'Clientes activos', value: customers?.activeInRange ?? 0, icon: Users, color: 'text-sky-600 bg-sky-50' },
    { label: 'Reabastecer', value: inv?.lowStock ?? 0, icon: PackageSearch, color: 'text-red-600 bg-red-50', href: '/admin/productos?stock=reabastecer' },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl text-stone-800 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Dashboard</h1>
          <p className="text-sm text-stone-400">Resumen general de D&apos;orella</p>
        </div>
        <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${days === r.days ? 'bg-white text-wine shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-5 mb-8">
        {kpis.map((k) => {
          const cardBody = (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2.5 rounded-lg ${k.color}`}><k.icon size={18} /></div>
                <span className="text-xs text-stone-400 uppercase tracking-wider font-medium">{k.label}</span>
              </div>
              <p className="text-2xl font-bold text-stone-800 font-functional" style={{ fontVariantNumeric: 'tabular-nums' }}>{k.value}</p>
              {'delta' in k && k.delta && (
                <div className="mt-2">
                  <DeltaBadge current={k.delta.current} previous={k.delta.previous} deltaPct={k.delta.pct} label="anterior" />
                </div>
              )}
            </>
          );
          const className = `bg-white rounded-xl border border-stone-200 p-6 shadow-sm block ${k.href ? 'transition-shadow hover:shadow-md cursor-pointer' : ''}`;

          return k.href ? (
            <Link key={k.label} href={k.href} className={className}>{cardBody}</Link>
          ) : (
            <div key={k.label} className={className}>{cardBody}</div>
          );
        })}
      </div>

      {/* Inventory Alerts */}
      {inv && (
        <div className="mb-8">
          <InventoryAlerts outOfStock={inv.outOfStock} lowStock={inv.lowStock} totalActiveProducts={inv.totalActiveProducts} totalUnits={inv.totalUnits} totalReserved={inv.totalReserved} inventoryValue={inv.inventoryValue} outOfStockProducts={inv.outOfStockProducts} lowStockProducts={inv.lowStockProducts} healthyProducts={inv.healthyProducts} />
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <RevenueTimelineChart data={data?.revenueTimeline ?? []} days={days} />
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <RevenueByTierChart data={data?.revenueByTier ?? []} days={days} />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <SalesByCategoryChart data={data?.salesByCategory ?? []} days={days} />
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <TopProductsChart data={data?.topProducts ?? []} days={days} />
        </div>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <StockDaysChart data={data?.topProducts ?? []} />
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <OrdersByStatusChart data={data?.ordersByStatus ?? {}} />
        </div>
      </div>

      {/* Top Customers */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm mb-8">
        <TopCustomersTable data={data?.topCustomers ?? []} days={days} />
      </div>

      {/* Tier upgrades + slow movers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <TierUpgradesTable data={data?.tierUpgrades ?? []} days={days} />
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-stone-700 mb-4">Lento Movimiento (sin ventas 30d)</h3>
          <SlowMoversTable data={data?.slowMovers ?? []} />
        </div>
      </div>

      {/* Restocking Priority */}
      {data?.restockAlerts && data.restockAlerts.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-stone-100">
            <h2 className="text-lg font-semibold text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Reabastecimiento Prioritario</h2>
            <p className="text-xs text-stone-400 mt-0.5">Productos que necesitan reposición en menos de 7 días</p>
          </div>
          <RestockingTable data={data.restockAlerts} />
        </div>
      )}

      {/* Recent Orders Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-stone-100">
          <h2 className="text-lg font-semibold text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Órdenes Recientes</h2>
        </div>
        {(!data?.recentOrders || data.recentOrders.length === 0) ? (
          <div className="text-center py-12 text-stone-400">No hay órdenes en el periodo</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-stone-400 uppercase tracking-wider border-b border-stone-100">
                  <th className="text-left px-6 py-3 font-medium">Orden</th>
                  <th className="text-left px-6 py-3 font-medium">Cliente</th>
                  <th className="text-left px-6 py-3 font-medium">Tier</th>
                  <th className="text-right px-6 py-3 font-medium">Total</th>
                  <th className="text-left px-6 py-3 font-medium">Estado</th>
                  <th className="text-left px-6 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((o, i) => (
                  <tr key={o.id} className={i % 2 === 0 ? 'bg-white' : 'bg-ivory/50'}>
                    <td className="px-6 py-3.5 font-medium text-stone-700">{o.orderNumber}</td>
                    <td className="px-6 py-3.5 text-stone-600">{o.customerName}</td>
                    <td className="px-6 py-3.5">
                      <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${TIER_COLORS[o.tierAtPurchase] || ''}`}>
                        {TIER_LABELS[o.tierAtPurchase] || o.tierAtPurchase}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-medium text-stone-700 font-functional" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCOP(o.total)}</td>
                    <td className="px-6 py-3.5">
                      <span className={`text-[9px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_STYLES[o.status] || ''}`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-stone-400 text-xs">{new Date(o.createdAt).toLocaleDateString('es-CO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
