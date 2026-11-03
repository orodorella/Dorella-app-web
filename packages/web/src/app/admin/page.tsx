'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { request } from '@/hooks/useApi';
import { formatDate, formatInt, formatMoney } from '@/lib/format';
import { DASHBOARD_PRESETS } from '@/lib/admin-period';
import { KPI_DEFINITIONS } from '@/lib/kpi-definitions';
import { usePeriod } from '@/hooks/usePeriod';
import PeriodSelector from '@/components/admin/PeriodSelector';
import PageHeader from '@/components/admin/PageHeader';
import KpiCard, { type KpiDelta } from '@/components/admin/KpiCard';
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

function FinancialDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [sectionStatus, setSectionStatus] = useState<Record<SectionKey, SectionStatus>>({ core: 'loading', charts: 'loading', inventory: 'loading' });
  const { period, setPeriod } = usePeriod(DASHBOARD_PRESETS);
  const days = period.days;
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
  const coreReady = sectionStatus.core === 'ready';
  const retry = (section: SectionKey) => () => { void fetchSection(days, section, requestId.current); };
  const vs = (pct: number | null | undefined): KpiDelta => ({ pct: pct ?? null, label: period.comparison.label, detail: period.comparison.rangeLabel });

  const kpis: Array<{ label: string; value: string; definition: string; delta?: KpiDelta; href?: string }> = [
    { label: 'Ventas confirmadas', value: formatMoney(s?.revenue ?? 0), definition: KPI_DEFINITIONS.ventasConfirmadas, delta: vs(s?.revenueDeltaPct) },
    { label: 'Ticket promedio', value: formatMoney(s?.aov ?? 0), definition: KPI_DEFINITIONS.ticketPromedio, delta: vs(s?.aovDeltaPct) },
    { label: 'Órdenes confirmadas', value: formatInt(s?.orders ?? 0), definition: KPI_DEFINITIONS.ordenesConfirmadas, delta: vs(s?.ordersDeltaPct) },
    { label: 'Por confirmar', value: formatInt(s?.pendingOrders ?? 0), definition: KPI_DEFINITIONS.porConfirmar },
    { label: 'Clientes activos', value: formatInt(customers?.activeInRange ?? 0), definition: KPI_DEFINITIONS.clientesActivos },
    { label: 'Reabastecer', value: formatInt(inv?.lowStock ?? 0), definition: KPI_DEFINITIONS.reabastecer, href: '/admin/productos?stock=reabastecer' },
  ];

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader title="Dashboard" subtitle="Resumen comercial y de inventario de D'orella.">
        <PeriodSelector
          period={period}
          presets={DASHBOARD_PRESETS}
          onChange={setPeriod}
          note="El Dashboard admite 7, 30 o 90 días. Para Hoy, Este mes o fechas exactas usa Resumen financiero o Rendimiento comercial."
        />
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} definition={k.definition} delta={k.delta} href={k.href} loading={!coreReady} />
        ))}
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
                      <h3 className="whitespace-nowrap font-mono text-sm font-semibold text-stone-800">{o.orderNumber}</h3>
                      <p className="mt-1 text-sm text-stone-500">{o.customerName}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`whitespace-nowrap text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${TIER_COLORS[o.tierAtPurchase] || ''}`}>
                        {TIER_LABELS[o.tierAtPurchase] || o.tierAtPurchase}
                      </span>
                      <span className={`whitespace-nowrap text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${STATUS_STYLES[o.status] || ''}`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-stone-400">Total</span>
                      <span className="mt-1 block font-medium text-stone-700">{formatMoney(o.total)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-stone-400">Fecha</span>
                      <span className="mt-1 block text-sm text-stone-500">{formatDate(o.createdAt)}</span>
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
                    <td className="whitespace-nowrap px-6 py-3.5 font-mono text-sm font-medium text-stone-800">{o.orderNumber}</td>
                    <td className="px-6 py-3.5 text-stone-600">{o.customerName}</td>
                    <td className="px-6 py-3.5">
                      <span className={`whitespace-nowrap text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${TIER_COLORS[o.tierAtPurchase] || ''}`}>
                        {TIER_LABELS[o.tierAtPurchase] || o.tierAtPurchase}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-medium text-stone-700 font-functional" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(o.total)}</td>
                    <td className="px-6 py-3.5">
                      <span className={`whitespace-nowrap text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${STATUS_STYLES[o.status] || ''}`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-stone-400 text-xs">{formatDate(o.createdAt)}</td>
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
