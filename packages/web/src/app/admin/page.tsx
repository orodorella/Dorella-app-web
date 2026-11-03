'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { DollarSign, ShoppingBag, Clock, TrendingUp, Loader2, PackageSearch, Users, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import InventoryAlerts from '@/components/admin/charts/InventoryAlerts';
const TopProductsChart = dynamic(() => import('@/components/admin/charts/TopProductsChart'), { ssr: false, loading: () => <BlockSkeleton height="h-[300px]" /> });
const RevenueTimelineChart = dynamic(() => import('@/components/admin/charts/RevenueTimelineChart'), { ssr: false, loading: () => <BlockSkeleton height="h-[300px]" /> });
const StockDaysChart = dynamic(() => import('@/components/admin/charts/StockDaysChart'), { ssr: false, loading: () => <BlockSkeleton height="h-[300px]" /> });
const OrdersByStatusChart = dynamic(() => import('@/components/admin/charts/OrdersByStatusChart'), { ssr: false, loading: () => <BlockSkeleton height="h-[300px]" /> });
import RestockingTable from '@/components/admin/charts/RestockingTable';
const RevenueByTierChart = dynamic(() => import('@/components/admin/charts/RevenueByTierChart'), { ssr: false, loading: () => <BlockSkeleton height="h-[300px]" /> });
const SalesByCategoryChart = dynamic(() => import('@/components/admin/charts/SalesByCategoryChart'), { ssr: false, loading: () => <BlockSkeleton height="h-[300px]" /> });
import TopCustomersTable from '@/components/admin/charts/TopCustomersTable';
import TierUpgradesTable from '@/components/admin/charts/TierUpgradesTable';
import SlowMoversTable from '@/components/admin/charts/SlowMoversTable';
import Pager from '@/components/admin/Pager';
import OperationalDashboard from '@/components/admin/OperationalDashboard';
import { useAuth } from '@/context/AuthProvider';

/** Marcador de posición para bloques que aún cargan (no bloquea al resto de la pantalla). */
function BlockSkeleton({ height = 'h-40' }: { height?: string }) {
  return <div aria-hidden className={`w-full animate-pulse rounded-lg bg-stone-100 ${height}`} />;
}

type SectionKey = 'core' | 'charts' | 'inventory';
type SectionStatus = 'loading' | 'ready' | 'error';

/** Muestra un esqueleto mientras carga, un error con «Reintentar» si falla, o el contenido. Cada sección es independiente. */
function Section({ status, onRetry, skeletonHeight, children }: { status: SectionStatus; onRetry: () => void; skeletonHeight?: string; children: React.ReactNode }) {
  if (status === 'loading') return <BlockSkeleton height={skeletonHeight} />;
  if (status === 'error') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
        <span>No se pudo cargar esta sección.</span>
        <button type="button" onClick={onRetry} className="cursor-pointer rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">Reintentar</button>
      </div>
    );
  }
  return <>{children}</>;
}

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

interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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

function FinancialDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [sectionStatus, setSectionStatus] = useState<Record<SectionKey, SectionStatus>>({ core: 'loading', charts: 'loading', inventory: 'loading' });
  const [days, setDays] = useState(30);
  const requestId = useRef(0);

  // Tier upgrades and slow movers are paginated independently of the bundled
  // dashboard summary above (which keeps its own small preview) — each owns
  // its page state and fetches from a dedicated paginated endpoint.
  const [tierUpgradesPage, setTierUpgradesPage] = useState(1);
  const [tierUpgradesData, setTierUpgradesData] = useState<DashboardData['tierUpgrades']>([]);
  const [tierUpgradesMeta, setTierUpgradesMeta] = useState<PageMeta | null>(null);

  const [slowMoversPage, setSlowMoversPage] = useState(1);
  const [slowMoversData, setSlowMoversData] = useState<DashboardData['slowMovers']>([]);
  const [slowMoversMeta, setSlowMoversMeta] = useState<PageMeta | null>(null);

  const [restockAlertsPage, setRestockAlertsPage] = useState(1);
  const [restockAlertsData, setRestockAlertsData] = useState<DashboardData['restockAlerts']>([]);
  const [restockAlertsMeta, setRestockAlertsMeta] = useState<PageMeta | null>(null);

  /** Cada sección pide solo lo suyo y se pinta cuando llega, sin esperar a las demás. */
  const fetchSection = useCallback(async (rangeDays: number, section: SectionKey, id: number) => {
    setSectionStatus((current) => ({ ...current, [section]: 'loading' }));
    try {
      const res = await request('GET', `/api/admin/dashboard?days=${rangeDays}&sections=${section}`);
      if (id !== requestId.current) return; // respuesta de un rango anterior
      if (!res.success) throw new Error(res.error?.message || 'error');
      const incoming = res.data as DashboardData;
      setData((prev) => {
        const base = prev ?? incoming;
        if (section === 'core') return { ...base, range: incoming.range, summary: incoming.summary, customers: incoming.customers, ordersByStatus: incoming.ordersByStatus, inventory: { ...base.inventory, ...incoming.inventory, outOfStockProducts: base.inventory.outOfStockProducts, lowStockProducts: base.inventory.lowStockProducts, healthyProducts: base.inventory.healthyProducts } };
        if (section === 'charts') return { ...base, revenueTimeline: incoming.revenueTimeline, revenueByTier: incoming.revenueByTier, salesByCategory: incoming.salesByCategory, topProducts: incoming.topProducts, topCustomers: incoming.topCustomers, recentOrders: incoming.recentOrders };
        return { ...base, restockAlerts: incoming.restockAlerts, inventory: { ...base.inventory, outOfStockProducts: incoming.inventory.outOfStockProducts, lowStockProducts: incoming.inventory.lowStockProducts, healthyProducts: incoming.inventory.healthyProducts } };
      });
      setSectionStatus((current) => ({ ...current, [section]: 'ready' }));
    } catch {
      if (id === requestId.current) setSectionStatus((current) => ({ ...current, [section]: 'error' }));
    }
  }, []);

  const fetchData = useCallback((rangeDays: number) => {
    const id = ++requestId.current;
    // Las tres secciones salen a la vez (en paralelo); la primera en llegar es la de KPIs, que es la más liviana.
    (['core', 'charts', 'inventory'] as SectionKey[]).forEach((section) => { void fetchSection(rangeDays, section, id); });
  }, [fetchSection]);

  useEffect(() => {
    request('GET', `/api/admin/dashboard/tier-upgrades?page=${tierUpgradesPage}&pageSize=10&days=${days}`)
      .then((res) => { if (res.success) { setTierUpgradesData(res.data); setTierUpgradesMeta(res.meta); } })
      .catch(() => {});
  }, [tierUpgradesPage, days]);

  useEffect(() => {
    request('GET', `/api/admin/dashboard/slow-movers?page=${slowMoversPage}&pageSize=10`)
      .then((res) => { if (res.success) { setSlowMoversData(res.data); setSlowMoversMeta(res.meta); } })
      .catch(() => {});
  }, [slowMoversPage]);

  useEffect(() => {
    request('GET', `/api/admin/dashboard/restock-alerts?page=${restockAlertsPage}&pageSize=10&days=${days}`)
      .then((res) => { if (res.success) { setRestockAlertsData(res.data); setRestockAlertsMeta(res.meta); } })
      .catch(() => {});
  }, [restockAlertsPage, days]);

  // Range changes affect the days-scoped panels' window — jump back to page 1.
  useEffect(() => {
    setTierUpgradesPage(1);
    setRestockAlertsPage(1);
  }, [days]);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  const s = data?.summary;
  const inv = data?.inventory;
  const customers = data?.customers;
  const rangeLabel = `${days} días`;
  const coreReady = sectionStatus.core === 'ready';
  const retry = (section: SectionKey) => () => { void fetchSection(days, section, requestId.current); };

  const kpis = [
    { label: `Ingresos (${rangeLabel})`, value: formatCOP(s?.revenue ?? 0), delta: { current: s?.revenue ?? 0, previous: s?.revenuePrev ?? 0, pct: s?.revenueDeltaPct ?? null }, icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Ticket Promedio', value: formatCOP(s?.aov ?? 0), delta: { current: s?.aov ?? 0, previous: s?.aovPrev ?? 0, pct: s?.aovDeltaPct ?? null }, icon: TrendingUp, color: 'text-wine bg-wine-50' },
    { label: `Órdenes (${rangeLabel})`, value: s?.orders ?? 0, delta: { current: s?.orders ?? 0, previous: s?.ordersPrev ?? 0, pct: s?.ordersDeltaPct ?? null }, icon: ShoppingBag, color: 'text-purple-600 bg-purple-50' },
    { label: 'Por confirmar', value: s?.pendingOrders ?? 0, icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { label: 'Clientes activos', value: customers?.activeInRange ?? 0, icon: Users, color: 'text-sky-600 bg-sky-50' },
    { label: 'Reabastecer', value: inv?.lowStock ?? 0, icon: PackageSearch, color: 'text-red-600 bg-red-50', href: '/admin/productos?stock=reabastecer' },
  ];

  return (
    <div className="min-w-0 space-y-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl text-stone-800 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Dashboard</h1>
          <p className="text-sm text-stone-400">Resumen general de D&apos;orella</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-1 rounded-lg bg-stone-100 p-1 sm:w-auto">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none ${days === r.days ? 'bg-white text-wine shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((k) => {
          const cardBody = (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2.5 rounded-lg ${k.color}`}><k.icon size={18} /></div>
                <span className="text-xs text-stone-400 uppercase tracking-wider font-medium">{k.label}</span>
              </div>
              {coreReady ? (
                <p className="text-2xl font-bold text-stone-800 font-functional" style={{ fontVariantNumeric: 'tabular-nums' }}>{k.value}</p>
              ) : (
                <div aria-hidden className="h-8 w-28 animate-pulse rounded bg-stone-100" />
              )}
              {coreReady && 'delta' in k && k.delta && (
                <div className="mt-2">
                  <DeltaBadge current={k.delta.current} previous={k.delta.previous} deltaPct={k.delta.pct} label="anterior" />
                </div>
              )}
            </>
          );
          const className = `block overflow-hidden rounded-xl border border-stone-200 bg-white p-6 shadow-sm ${k.href ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`;

          return k.href ? (
            <Link key={k.label} href={k.href} className={className}>{cardBody}</Link>
          ) : (
            <div key={k.label} className={className}>{cardBody}</div>
          );
        })}
      </div>

      {/* Inventory Alerts: conteos (núcleo) + listas (sección inventario) */}
      <Section status={!coreReady ? 'loading' : sectionStatus.inventory} onRetry={retry('inventory')} skeletonHeight="h-48">
      {inv && (
        <div className="mb-8">
          <InventoryAlerts outOfStock={inv.outOfStock} lowStock={inv.lowStock} totalActiveProducts={inv.totalActiveProducts} totalUnits={inv.totalUnits} totalReserved={inv.totalReserved} inventoryValue={inv.inventoryValue} outOfStockProducts={inv.outOfStockProducts} lowStockProducts={inv.lowStockProducts} healthyProducts={inv.healthyProducts} />
        </div>
      )}
      </Section>

      <Section status={sectionStatus.charts} onRetry={retry('charts')} skeletonHeight="h-[320px]">
      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <RevenueTimelineChart data={data?.revenueTimeline ?? []} days={days} />
        </div>
        <div className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <RevenueByTierChart data={data?.revenueByTier ?? []} days={days} />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <SalesByCategoryChart data={data?.salesByCategory ?? []} days={days} />
        </div>
        <div className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <TopProductsChart data={data?.topProducts ?? []} days={days} />
        </div>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <StockDaysChart data={data?.topProducts ?? []} />
        </div>
        <div className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <OrdersByStatusChart data={data?.ordersByStatus ?? {}} />
        </div>
      </div>

      {/* Top Customers */}
      <div className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <TopCustomersTable data={data?.topCustomers ?? []} days={days} />
      </div>
      </Section>

      {/* Tier upgrades + slow movers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="p-6 pb-0">
            <TierUpgradesTable data={tierUpgradesData} days={days} />
          </div>
          {tierUpgradesMeta ? (
            <Pager
              page={tierUpgradesMeta.page}
              totalPages={tierUpgradesMeta.totalPages}
              total={tierUpgradesMeta.total}
              totalLabel="cambios de tier"
              onChange={setTierUpgradesPage}
            />
          ) : null}
        </div>
        <div className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="p-6 pb-0">
            <h3 className="text-sm font-semibold text-stone-700 mb-4">Lento Movimiento (sin ventas 30d)</h3>
            <SlowMoversTable data={slowMoversData} />
          </div>
          {slowMoversMeta ? (
            <Pager
              page={slowMoversMeta.page}
              totalPages={slowMoversMeta.totalPages}
              total={slowMoversMeta.total}
              totalLabel="productos"
              onChange={setSlowMoversPage}
            />
          ) : null}
        </div>
      </div>

      {/* Restocking Priority */}
      {restockAlertsData.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="px-6 py-5 border-b border-stone-100">
            <h2 className="text-lg font-semibold text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Reabastecimiento Prioritario</h2>
            <p className="text-xs text-stone-400 mt-0.5">Productos que necesitan reposición en menos de 7 días</p>
          </div>
          <RestockingTable data={restockAlertsData} />
          {restockAlertsMeta ? (
            <Pager
              page={restockAlertsMeta.page}
              totalPages={restockAlertsMeta.totalPages}
              total={restockAlertsMeta.total}
              totalLabel="productos"
              onChange={setRestockAlertsPage}
            />
          ) : null}
        </div>
      )}

      {/* Recent Orders Table */}
      <Section status={sectionStatus.charts} onRetry={retry('charts')} skeletonHeight="h-56">
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100">
          <h2 className="text-lg font-semibold text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Órdenes Recientes</h2>
          <Link href="/admin/ordenes" className="text-xs font-medium text-wine hover:underline">Ver todas →</Link>
        </div>
        {(!data?.recentOrders || data.recentOrders.length === 0) ? (
          <div className="text-center py-12 text-stone-400">No hay órdenes en el periodo</div>
        ) : (
          <>
            <div className="space-y-3 p-4 lg:hidden">
              {data.recentOrders.map((o) => (
                <article key={o.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-stone-800">{o.orderNumber}</h3>
                      <p className="mt-1 text-sm text-stone-500">{o.customerName}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${TIER_COLORS[o.tierAtPurchase] || ''}`}>
                        {TIER_LABELS[o.tierAtPurchase] || o.tierAtPurchase}
                      </span>
                      <span className={`text-[9px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_STYLES[o.status] || ''}`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-stone-400">Total</span>
                      <span className="mt-1 block font-medium text-stone-700">{formatCOP(o.total)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-stone-400">Fecha</span>
                      <span className="mt-1 block text-sm text-stone-500">{new Date(o.createdAt).toLocaleDateString('es-CO')}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-[760px] w-full text-sm">
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
          </>
        )}
      </div>
      </Section>
    </div>
  );
}

// Bodega ve solo el tablero operativo; las cifras de venta son del administrador.
export default function AdminDashboardPage() {
  const { user } = useAuth();
  if (user?.role === 'bodega') return <OperationalDashboard />;
  return <FinancialDashboardPage />;
}
