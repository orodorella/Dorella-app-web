'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { useToast } from '@/context/ToastProvider';

const TIER_LABELS: Record<string, string> = { detal: 'Detal', por_mayor: 'Por mayor', gran_mayor: 'Gran mayor' };

interface Dashboard {
  from: string; to: string;
  ventas: { total: number; ordenes: number; ticketPromedio: number; variacionPct: number | null;
    porComercial: Array<{ sellerId: string; nombre: string; ventas: number; ordenes: number; participacionPct: number | null }>;
    porModalidad: Array<{ tier: string; revenue: number; units: number }> };
  rentabilidad: { ingresoCobradoCosteado: number; costoMercanciaVendida: number; utilidadBruta: number; margenBrutoPct: number | null; ingresoPendienteCosteo: number };
  comisiones: { causadasEnPeriodo: number; porPagar: number };
  gastos: { total: number; porCategoria: Array<{ categoria: string; total: number }> };
  resultadoOperativoEstimado: number;
  advertencias: string[];
}

const isoDay = (d: Date) => new Date(d.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
const field = 'rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700';

function Card({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'wine' | 'gold' }) {
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${tone === 'wine' ? 'border-wine/30' : tone === 'gold' ? 'border-gold/40' : 'border-stone-200'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{label}</p>
      <p className={`mt-2 text-2xl ${tone === 'wine' ? 'text-wine' : 'text-stone-800'}`} style={{ fontFamily: 'var(--font-display)' }}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-stone-400">{hint}</p> : null}
    </div>
  );
}

export default function FinanzasPage() {
  const { showToast } = useToast();
  const [from, setFrom] = useState(`${isoDay(new Date()).slice(0, 8)}01`);
  const [to, setTo] = useState(isoDay(new Date()));
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await request('GET', `/api/admin/finance/summary?from=${from}&to=${to}`);
      if (!res.success) throw new Error(res.error?.message || 'No se pudo cargar el resumen');
      setData(res.data as Dashboard);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void load(); }, [load]);

  async function exportCsv() {
    const res = await fetch(`/api/admin/finance/summary/export?from=${from}&to=${to}`, { credentials: 'include' });
    if (!res.ok) { showToast('No se pudo exportar', 'error'); return; }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url; a.download = `resumen-financiero-${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1 className="mb-1 text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Resumen financiero</h1>
      <p className="mb-5 text-sm text-stone-400">Vista exclusiva del administrador.</p>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-xs text-stone-500">Desde<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={`${field} mt-1 block`} /></label>
        <label className="text-xs text-stone-500">Hasta<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={`${field} mt-1 block`} /></label>
        <button onClick={exportCsv} className="cursor-pointer rounded-lg bg-wine px-4 py-2 text-xs font-semibold text-white hover:bg-wine-light">Exportar CSV</button>
      </div>

      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-wine" /></div> : null}

      {data && !loading ? (
        <>
          <ul className="mb-5 list-disc space-y-1 rounded-xl bg-amber-50 p-4 pl-8 text-xs text-amber-800">
            {data.advertencias.map((a) => <li key={a}>{a}</li>)}
          </ul>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card label="Ventas del periodo" value={formatCOP(data.ventas.total)} hint={`${data.ventas.ordenes} órdenes · ticket ${formatCOP(data.ventas.ticketPromedio)}${data.ventas.variacionPct !== null ? ` · ${data.ventas.variacionPct >= 0 ? '+' : ''}${data.ventas.variacionPct}% vs. anterior` : ''}`} />
            <Card label="Costo de mercancía vendida" value={formatCOP(data.rentabilidad.costoMercanciaVendida)} hint={`Sobre ingreso cobrado ${formatCOP(data.rentabilidad.ingresoCobradoCosteado)}`} />
            <Card label="Utilidad bruta" value={formatCOP(data.rentabilidad.utilidadBruta)} hint={data.rentabilidad.margenBrutoPct !== null ? `Margen bruto ${data.rentabilidad.margenBrutoPct}%` : 'Sin base de cálculo'} tone="gold" />
            <Card label="Comisiones por pagar" value={formatCOP(data.comisiones.porPagar)} hint={`Causadas en el periodo: ${formatCOP(data.comisiones.causadasEnPeriodo)}`} />
            <Card label="Gastos operativos" value={formatCOP(data.gastos.total)} hint="Incluye categorías que no afectan resultado" />
            <Card label="Resultado operativo estimado" value={formatCOP(data.resultadoOperativoEstimado)} hint="Utilidad bruta − comisiones − gastos que afectan resultado" tone="wine" />
            <Card label="Pendiente de costeo" value={formatCOP(data.rentabilidad.ingresoPendienteCosteo)} hint="Ventas sin costo registrado" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-stone-700">Ventas por comercial</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.ventas.porComercial}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                  <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: '#a8a29e' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#a8a29e' }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v) => formatCOP(Number(v))} />
                  <Bar dataKey="ventas" name="Ventas" fill="#5B0E16" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
            <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-stone-700">Ventas por modalidad</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.ventas.porModalidad.map((t) => ({ ...t, label: TIER_LABELS[t.tier] }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a8a29e' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#a8a29e' }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v) => formatCOP(Number(v))} />
                  <Bar dataKey="revenue" name="Ventas" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>

          <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-stone-700">Mayores categorías de gasto</h2>
            <ul className="space-y-1 text-sm">
              {data.gastos.porCategoria.length === 0 ? <li className="text-stone-400">Sin gastos en el periodo.</li> : data.gastos.porCategoria.map((c) => (
                <li key={c.categoria} className="flex justify-between"><span>{c.categoria}</span><span>{formatCOP(c.total)}</span></li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
