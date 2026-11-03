'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';

const TIERS = ['detal', 'por_mayor', 'gran_mayor'] as const;
const TIER_LABELS: Record<string, string> = { detal: 'Detal', por_mayor: 'Por mayor', gran_mayor: 'Gran mayor' };
const LINE_COLORS = ['#5B0E16', '#C9A84C', '#0f766e', '#7c3aed', '#a8a29e'];
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmado', invoiced: 'Facturado',
  shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado',
};

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

interface Option { id: string; nombre: string }

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-stone-300">—</span>;
  return <span className={value >= 0 ? 'text-emerald-600' : 'text-red-600'}>{value >= 0 ? '+' : ''}{value}%</span>;
}

export default function RendimientoComercialPage() {
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(isoDay(new Date(today.getTime() - 29 * 86_400_000)));
  const [to, setTo] = useState(isoDay(today));
  const [sellerId, setSellerId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tier, setTier] = useState('');
  const [status, setStatus] = useState('');
  const [granularity, setGranularity] = useState('day');
  const [sellers, setSellers] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [report, setReport] = useState<Report | null>(null);
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
      const qs = new URLSearchParams({ from, to, granularity });
      if (sellerId) qs.set('sellerId', sellerId);
      if (categoryId) qs.set('categoryId', categoryId);
      if (tier) qs.set('tier', tier);
      if (status) qs.set('status', status);
      const res = await request('GET', `/api/admin/sales/performance?${qs}`);
      if (!res.success) throw new Error(res.error?.message || 'No se pudo cargar el reporte');
      setReport(res.data as Report);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [from, to, sellerId, categoryId, tier, status, granularity]);

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

  const comparison = report?.sellers.map((s) => ({ nombre: s.nombre, Ventas: s.revenue })) ?? [];

  const field = 'rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700';

  return (
    <div>
      <h1 className="mb-1 text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Rendimiento comercial</h1>
      <p className="mb-6 text-sm text-stone-400">
        Venta = mercancía después de descuentos, sin fletes, de órdenes no canceladas. Horario de Colombia.
      </p>

      <div className="mb-6 grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-stone-500">Desde<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={`${field} mt-1 w-full`} /></label>
        <label className="text-xs text-stone-500">Hasta<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={`${field} mt-1 w-full`} /></label>
        <label className="text-xs text-stone-500">Comercial
          <select value={sellerId} onChange={(e) => setSellerId(e.target.value)} className={`${field} mt-1 w-full`}>
            <option value="">Todos</option>
            <option value="sin-asignar">Sin comercial asignado</option>
            {sellers.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
        <label className="text-xs text-stone-500">Categoría
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${field} mt-1 w-full`}>
            <option value="">Todas</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label className="text-xs text-stone-500">Modalidad
          <select value={tier} onChange={(e) => setTier(e.target.value)} className={`${field} mt-1 w-full`}>
            <option value="">Todas</option>
            {TIERS.map((t) => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
          </select>
        </label>
        <label className="text-xs text-stone-500">Estado
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${field} mt-1 w-full`}>
            <option value="">Todos (sin canceladas)</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="text-xs text-stone-500">Agrupar por
          <select value={granularity} onChange={(e) => setGranularity(e.target.value)} className={`${field} mt-1 w-full`}>
            <option value="day">Día</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
          </select>
        </label>
      </div>

      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-wine" /></div> : null}

      {report && !loading ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ['Ventas', formatCOP(report.totals.revenue)],
              ['Órdenes', String(report.totals.orders)],
              ['Ticket promedio', formatCOP(report.totals.ticketPromedio)],
              ['Unidades', report.totals.units.toLocaleString('es-CO')],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{label}</p>
                <p className="mt-2 text-2xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-400">
            Periodo anterior ({report.previousPeriod.from} a {report.previousPeriod.to}): {formatCOP(report.totals.periodoAnterior)} · <Delta value={report.totals.variacionPct} />
          </p>

          <section className="mt-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400">
                <tr>
                  <th className="px-4 py-3 text-left">Comercial</th>
                  {TIERS.map((t) => <th key={t} className="px-4 py-3 text-right">{TIER_LABELS[t]}</th>)}
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Órdenes</th>
                  <th className="px-4 py-3 text-right">Ticket</th>
                  <th className="px-4 py-3 text-right">Part.</th>
                  <th className="px-4 py-3 text-right">vs. anterior</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {report.sellers.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-stone-400">Sin ventas en el periodo.</td></tr>
                ) : report.sellers.map((s) => (
                  <tr key={s.sellerId}>
                    <td className="px-4 py-3 font-medium text-stone-700">{s.nombre}</td>
                    {TIERS.map((t) => <td key={t} className="px-4 py-3 text-right text-stone-600">{formatCOP(s.byTier[t]?.revenue ?? 0)}</td>)}
                    <td className="px-4 py-3 text-right font-semibold text-wine">{formatCOP(s.revenue)}</td>
                    <td className="px-4 py-3 text-right">{s.orders}</td>
                    <td className="px-4 py-3 text-right">{formatCOP(s.ticketPromedio)}</td>
                    <td className="px-4 py-3 text-right">{s.participacionPct !== null ? `${s.participacionPct}%` : '—'}</td>
                    <td className="px-4 py-3 text-right"><Delta value={s.variacionPct} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-stone-700">Comparación entre comerciales</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={comparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                  <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: '#a8a29e' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#a8a29e' }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v) => formatCOP(Number(v))} />
                  <Bar dataKey="Ventas" fill="#5B0E16" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-stone-700">Ventas por modalidad</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={report.byTier.map((t) => ({ ...t, label: TIER_LABELS[t.tier] }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a8a29e' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#a8a29e' }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v) => formatCOP(Number(v))} />
                  <Bar dataKey="revenue" name="Ventas" radius={[4, 4, 0, 0]} fill="#C9A84C" />
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>

          <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-stone-700">Evolución de ventas</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineData.rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: '#a8a29e' }} />
                <YAxis tick={{ fontSize: 10, fill: '#a8a29e' }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => formatCOP(Number(v))} />
                <Legend />
                {timelineData.names.map((name, i) => (
                  <Line key={name} type="monotone" dataKey={name} stroke={LINE_COLORS[i % LINE_COLORS.length]} dot={false} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section className="mt-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400">
                <tr><th className="px-4 py-3 text-left">Categoría</th><th className="px-4 py-3 text-right">Unidades</th><th className="px-4 py-3 text-right">Ventas</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {report.byCategory.map((c) => (
                  <tr key={c.categoryId}><td className="px-4 py-3">{c.category}</td><td className="px-4 py-3 text-right">{c.units}</td><td className="px-4 py-3 text-right">{formatCOP(c.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </div>
  );
}
