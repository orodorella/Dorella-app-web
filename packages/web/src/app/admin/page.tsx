'use client';

import { useState, useEffect } from 'react';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { DollarSign, ShoppingBag, Clock, TrendingUp, Loader2, PackageSearch } from 'lucide-react';
import InventoryAlerts from '@/components/admin/charts/InventoryAlerts';
import TopProductsChart from '@/components/admin/charts/TopProductsChart';
import RevenueTimelineChart from '@/components/admin/charts/RevenueTimelineChart';
import StockDaysChart from '@/components/admin/charts/StockDaysChart';
import OrdersByStatusChart from '@/components/admin/charts/OrdersByStatusChart';
import RestockingTable from '@/components/admin/charts/RestockingTable';

const STATUS_STYLES: Record<string, string> = { pending: 'bg-amber-50 text-amber-700', confirmed: 'bg-blue-50 text-blue-700', invoiced: 'bg-blue-50 text-blue-700', shipped: 'bg-purple-50 text-purple-700', delivered: 'bg-emerald-50 text-emerald-700', cancelled: 'bg-red-50 text-red-700' };
const STATUS_LABELS: Record<string, string> = { pending: 'Pendiente', confirmed: 'Confirmado', invoiced: 'Facturado', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado' };
const TIER_LABELS: Record<string, string> = { detal: 'Detal', por_mayor: 'Por Mayor', gran_mayor: 'Gran Mayor' };
const TIER_COLORS: Record<string, string> = { detal: 'bg-stone-100 text-stone-600', por_mayor: 'bg-gold/10 text-gold-dark border border-gold/20', gran_mayor: 'bg-wine/10 text-wine border border-wine/20' };

interface DashboardData {
  summary: { totalRevenue: number; revenueLast7Days: number; revenueLast30Days: number; averageOrderValue: number; totalOrders: number; pendingOrders: number; };
  inventory: { totalActiveProducts: number; outOfStock: number; lowStock: number; totalUnits: number; totalReserved: number; };
  topProducts: Array<{ productId: string; sku: string; nombre: string; stock: number; imagenes: string[]; totalSold: number; averageDaily: number; daysOfInventory: number | null; totalRevenue: number; averageDailyRevenue: number; }>;
  restockAlerts: Array<{ productId: string; sku: string; nombre: string; stock: number; imagenes: string[]; totalSold: number; averageDaily: number; daysOfInventory: number | null; totalRevenue: number; averageDailyRevenue: number; }>;
  ordersByStatus: Record<string, number>;
  revenueTimeline: Array<{ date: string; revenue: number; }>;
  recentOrders: Array<{ id: string; orderNumber: string; status: string; total: number; tierAtPurchase: string; customerName: string; createdAt: string; }>;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request('GET', '/api/admin/dashboard')
      .then((res) => { if (res.success) setData(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-wine" /></div>;

  const s = data?.summary;
  const inv = data?.inventory;

  const kpis = [
    { label: 'Ingresos (30d)', value: formatCOP(s?.revenueLast30Days ?? 0), icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Ticket Promedio', value: formatCOP(s?.averageOrderValue ?? 0), icon: TrendingUp, color: 'text-wine bg-wine-50' },
    { label: 'Órdenes totales', value: s?.totalOrders ?? 0, icon: ShoppingBag, color: 'text-purple-600 bg-purple-50' },
    { label: 'Pendientes', value: s?.pendingOrders ?? 0, icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { label: 'Reabastecer (7d)', value: data?.restockAlerts?.length ?? 0, icon: PackageSearch, color: 'text-red-600 bg-red-50' },
  ];

  return (
    <div>
      <h1 className="text-3xl text-stone-800 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Dashboard</h1>
      <p className="text-sm text-stone-400 mb-8">Resumen general de D&apos;orella</p>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2.5 rounded-lg ${k.color}`}><k.icon size={18} /></div>
              <span className="text-xs text-stone-400 uppercase tracking-wider font-medium">{k.label}</span>
            </div>
            <p className="text-2xl font-bold text-stone-800 font-functional" style={{ fontVariantNumeric: 'tabular-nums' }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Inventory Alerts */}
      {inv && (
        <div className="mb-8">
          <InventoryAlerts outOfStock={inv.outOfStock} lowStock={inv.lowStock} totalActiveProducts={inv.totalActiveProducts} totalUnits={inv.totalUnits} totalReserved={inv.totalReserved} />
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <TopProductsChart data={data?.topProducts ?? []} />
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <RevenueTimelineChart data={data?.revenueTimeline ?? []} />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <StockDaysChart data={data?.topProducts ?? []} />
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <OrdersByStatusChart data={data?.ordersByStatus ?? {}} />
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
          <div className="text-center py-12 text-stone-400">No hay órdenes aún</div>
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
