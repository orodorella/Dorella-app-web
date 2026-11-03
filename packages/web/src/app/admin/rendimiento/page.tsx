'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, UserPlus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { request } from '@/hooks/useApi';
import { usePeriod } from '@/hooks/usePeriod';
import { deltaPct, formatDayMonth, formatInt, formatMoney, formatMoneyCompact, formatMonth, formatPct } from '@/lib/format';
import { KPI_DEFINITIONS } from '@/lib/kpi-definitions';
import PageHeader from '@/components/admin/PageHeader';
import PeriodSelector from '@/components/admin/PeriodSelector';
import KpiCard, { DeltaText, type KpiDelta } from '@/components/admin/KpiCard';
import HowCalculated from '@/components/admin/HowCalculated';
import { card, CHART_AXIS_TICK, CHART_GRID, field, fieldLabel, sectionTitle, th } from '@/components/admin/styles';

const TIERS = ['detal', 'por_mayor', 'gran_mayor'] as const;
const TIER_LABELS: Record<string, string> = { detal: 'Detal', por_mayor: 'Por mayor', gran_mayor: 'Gran mayor' };
const LINE_COLORS = ['#5B0E16', '#C9A84C', '#0f766e', '#7c3aed', '#a8a29e'];
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmado', invoiced: 'Facturado',
  shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado',
};
const RULES = [
  KPI_DEFINITIONS.ventas,
  'Las órdenes sin comercial asignado se agrupan como «Sin comercial asignado».',
  'La participación es la parte de las ventas del periodo que corresponde a cada comercial.',
];

interface SellerRow {
  sellerId: string;
  nombre: string;
  orders: number;
  units: number;
  revenue: number;
  paidRevenue: number;
  ticketPromedio: number;
  participacionPct: number | null;
  periodoAnterior: number;
  variacionPct: number | null;
  byTier: Record<string, { revenue: number; units: number }>;
}

interface Report {
  previousPeriod: { from: string; to: string };
  totals: { revenue: number; orders: number; units: number; ticketPromedio: number; periodoAnterior: number; variacionPct: number | null };
  sellers: SellerRow[];
  byTier: Array<{ tier: string; revenue: number; units: number }>;
  byCategory: Array<{ categoryId: string; category: string; units: number; revenue: number }>;
  timeline: Array<{ bucket: string; sellerId: string; sellerName: string; revenue: number; orders: number }>;
}

interface Option { id: string; nombre: string; role?: string }

export default function RendimientoComercialPage() {
  const { period, setPeriod } = usePeriod();
  const { from, to, comparison } = period;
  const [sellerId, setSellerId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tier, setTier] = useState('');
  const [status, setStatus] = useState('');
  const [granularity, setGranularity] = useState('day');
  const [sellers, setSellers] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  // Ventas del periodo comparado cuando no es el que trae el API (mes en curso / mes pasado).
  const [compare, setCompare] = useState<{ total: number; bySeller: Map<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    request('GET', '/api/admin/sales/sellers').then((res) => {
      if (res.success) setSellers((res.data as Option[]));
    }).catch(() => undefined);
    request('GET', '/api/categories').then((res) => {
      if (res.success) setCategories((res.data as Option[]));
    }).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters = new URLSearchParams({ granularity });
      if (sellerId) filters.set('sellerId', sellerId);
      if (categoryId) filters.set('categoryId', categoryId);
      if (tier) filters.set('tier', tier);
      if (status) filters.set('status', status);
      const qs = (a: string, b: string) => { const q = new URLSearchParams(filters); q.set('from', a); q.set('to', b); return q.toString(); };
      const [res, prev] = await Promise.all([
        request('GET', `/api/admin/sales/performance?${qs(from, to)}`),
        comparison.matchesApi ? Promise.resolve(null) : request('GET', `/api/admin/sales/performance?${qs(comparison.from, comparison.to)}`),
      ]);
      if (!res.success) throw new Error(res.error?.message || 'No se pudo cargar el reporte');
      setReport(res.data as Report);
      if (prev?.success) {
        const p = prev.data as Report;
        setCompare({ total: p.totals.revenue, bySeller: new Map(p.sellers.map((s) => [s.sellerId, s.revenue])) });
      } else {
        setCompare(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [from, to, comparison.matchesApi, comparison.from, comparison.to, sellerId, categoryId, tier, status, granularity]);

  useEffect(() => {
    void load();
  }, [load]);

  const timelineData = useMemo(() => {
    if (!report) return { rows: [] as Array<Record<string, number | string>>, names: [] as string[] };
    const names = [...new Set(report.timeline.map((t) => t.sellerName))];
    const byBucket = new Map<string, Record<string, number | string>>();
    for (const t of report.timeline) {
      const row = byBucket.get(t.bucket) ?? { bucket: t.bucket };
      row[t.sellerName] = ((row[t.sellerName] as number) ?? 0) + t.revenue;
      byBucket.set(t.bucket, row);
    }
    return { rows: [...byBucket.values()], names };
  }, [report]);

  // Comparar solo tiene sentido con 2 o más comerciales (usuarios con rol comercial y con barras que comparar).
  const comerciales = sellers.filter((s) => s.role === 'comercial').length;
  const canCompare = comerciales > 1 && (report?.sellers.length ?? 0) > 1;
  const comparisonChart = report?.sellers.map((s) => ({ nombre: s.nombre, Ventas: s.revenue })) ?? [];
  const bucketLabel = (b: string) => (granularity === 'month' ? formatMonth(b.slice(0, 7)) : formatDayMonth(b));

  const totalDelta = (r: Report): KpiDelta => ({
    pct: comparison.matchesApi ? r.totals.variacionPct : compare ? deltaPct(r.totals.revenue, compare.total) : null,
    label: comparison.label,
    detail: comparison.rangeLabel,
  });
  const sellerDelta = (s: SellerRow): number | null =>
    comparison.matchesApi ? s.variacionPct : compare ? deltaPct(s.revenue, compare.bySeller.get(s.sellerId) ?? 0) : null;
  const comparedTotal = report ? (comparison.matchesApi ? report.totals.periodoAnterior : compare?.total ?? null) : null;

  return (
    <div>
      <PageHeader title="Rendimiento comercial" subtitle="Ventas por comercial, modalidad y categoría.">
        <PeriodSelector period={period} onChange={setPeriod} />
      </PageHeader>

      <div className={`${card} mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5`}>
        <label className={fieldLabel}>Comercial
          <select value={sellerId} onChange={(e) => setSellerId(e.target.value)} className={`${field} mt-1 w-full`}>
            <option value="">Todos</option>
            <option value="sin-asignar">Sin comercial asignado</option>
            {sellers.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
        <label className={fieldLabel}>Categoría
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${field} mt-1 w-full`}>
            <option value="">Todas</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label className={fieldLabel}>Modalidad
          <select value={tier} onChange={(e) => setTier(e.target.value)} className={`${field} mt-1 w-full`}>
            <option value="">Todas</option>
            {TIERS.map((t) => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
          </select>
        </label>
        <label className={fieldLabel}>Estado
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${field} mt-1 w-full`}>
            <option value="">Todos (sin canceladas)</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className={fieldLabel}>Agrupar por
          <select value={granularity} onChange={(e) => setGranularity(e.target.value)} className={`${field} mt-1 w-full`}>
            <option value="day">Día</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
          </select>
        </label>
      </div>

      <div className="mb-5"><HowCalculated rules={RULES} /></div>

      {error ? <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-wine" aria-label="Cargando" /></div> : null}

      {report && !loading ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Ventas" value={formatMoney(report.totals.revenue)} definition={KPI_DEFINITIONS.ventas} delta={totalDelta(report)}
              hint={comparedTotal !== null ? `Periodo comparado (${comparison.rangeLabel}): ${formatMoney(comparedTotal)}` : undefined} />
            <KpiCard label="Órdenes" value={formatInt(report.totals.orders)} definition={KPI_DEFINITIONS.ordenesVenta} />
            <KpiCard label="Ticket promedio" value={formatMoney(report.totals.ticketPromedio)} definition={KPI_DEFINITIONS.ticketVenta} />
            <KpiCard label="Unidades" value={formatInt(report.totals.units)} definition={KPI_DEFINITIONS.unidades} />
          </div>

          <section className={`${card} mt-6 overflow-x-auto`}>
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className={`${th} text-left`}>Comercial</th>
                  {TIERS.map((t) => <th key={t} className={`${th} text-right`}>{TIER_LABELS[t]}</th>)}
                  <th className={`${th} text-right`}>Total</th>
                  <th className={`${th} text-right`}>Órdenes</th>
                  <th className={`${th} text-right`}>Ticket</th>
                  <th className={`${th} text-right`}>Part.</th>
                  <th className={`${th} text-right`}>Variación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 tabular-nums">
                {report.sellers.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-stone-600">Sin ventas en el periodo.</td></tr>
                ) : report.sellers.map((s) => (
                  <tr key={s.sellerId}>
                    <td className="px-4 py-3 font-medium text-stone-800">{s.nombre}</td>
                    {TIERS.map((t) => <td key={t} className="px-4 py-3 text-right text-stone-700">{formatMoney(s.byTier[t]?.revenue ?? 0)}</td>)}
                    <td className="px-4 py-3 text-right font-semibold text-wine">{formatMoney(s.revenue)}</td>
                    <td className="px-4 py-3 text-right">{formatInt(s.orders)}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(s.ticketPromedio)}</td>
                    <td className="px-4 py-3 text-right">{formatPct(s.participacionPct)}</td>
                    <td className="px-4 py-3 text-right"><DeltaText delta={{ pct: sellerDelta(s), label: '' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-stone-100 px-4 py-2 text-xs text-stone-600">Variación {comparison.label} ({comparison.rangeLabel}).</p>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {canCompare ? (
              <section className={`${card} min-w-0 p-5`}>
                <h2 className={`${sectionTitle} mb-4`}>Comparación entre comerciales</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={comparisonChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis dataKey="nombre" tick={CHART_AXIS_TICK} />
                    <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => formatMoneyCompact(Number(v))} width={72} />
                    <Tooltip formatter={(v) => formatMoney(Number(v))} />
                    <Bar dataKey="Ventas" fill="#5B0E16" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </section>
            ) : (
              <section className={`${card} flex min-w-0 flex-col items-start justify-center gap-3 border-dashed p-6`}>
                <UserPlus size={22} className="text-wine" aria-hidden />
                <h2 className={sectionTitle}>Aún no hay comerciales para comparar</h2>
                <p className="text-sm text-stone-700">
                  {comerciales <= 1
                    ? `${comerciales === 0 ? 'No hay usuarios' : 'Hay un solo usuario'} con rol comercial. Asigna el rol comercial a tu equipo de ventas y relaciónalo con sus pedidos para comparar su rendimiento.`
                    : 'En este periodo solo un comercial tiene ventas. Amplía el periodo o quita filtros para comparar.'}
                </p>
                {comerciales <= 1 ? <Link href="/admin/usuarios" className="text-sm font-semibold text-wine underline-offset-4 hover:underline">Ir a Usuarios</Link> : null}
              </section>
            )}

            <section className={`${card} min-w-0 p-5`}>
              <h2 className={`${sectionTitle} mb-4`}>Ventas por modalidad</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={report.byTier.map((t) => ({ ...t, label: TIER_LABELS[t.tier] }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="label" tick={CHART_AXIS_TICK} />
                  <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => formatMoneyCompact(Number(v))} width={72} />
                  <Tooltip formatter={(v) => formatMoney(Number(v))} />
                  <Bar dataKey="revenue" name="Ventas" radius={[4, 4, 0, 0]} fill="#C9A84C" />
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>

          <section className={`${card} mt-6 min-w-0 p-5`}>
            <h2 className={`${sectionTitle} mb-4`}>Evolución de ventas</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineData.rows}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="bucket" tick={CHART_AXIS_TICK} tickFormatter={(b) => bucketLabel(String(b))} minTickGap={16} />
                <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => formatMoneyCompact(Number(v))} width={72} />
                <Tooltip formatter={(v) => formatMoney(Number(v))} labelFormatter={(b) => bucketLabel(String(b))} />
                <Legend />
                {timelineData.names.map((name, i) => (
                  <Line key={name} type="monotone" dataKey={name} stroke={LINE_COLORS[i % LINE_COLORS.length]} dot={false} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section className={`${card} mt-6 overflow-x-auto`}>
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-stone-50">
                <tr><th className={`${th} text-left`}>Categoría</th><th className={`${th} text-right`}>Unidades</th><th className={`${th} text-right`}>Ventas</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100 tabular-nums">
                {report.byCategory.map((c) => (
                  <tr key={c.categoryId}><td className="px-4 py-3">{c.category}</td><td className="px-4 py-3 text-right">{formatInt(c.units)}</td><td className="px-4 py-3 text-right">{formatMoney(c.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </div>
  );
}
