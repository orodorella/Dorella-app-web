'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';

const TIER_LABELS: Record<string, string> = { detal: 'Detal', por_mayor: 'Por mayor', gran_mayor: 'Gran mayor' };

interface Metrics {
  ingreso: number; costo: number; utilidad: number; margenPct: number | null; recargoPct: number | null;
  ingresoPendienteCosteo: number; unidades: number; unidadesPendientes: number;
}
interface Report {
  notas: string[];
  resumen: Metrics & { comisionesCausadas: number; utilidadDespuesDeComisiones: number; gastosOperativos: number; resultadoOperativoEstimado: number };
  porProducto: Array<Metrics & { id: string; sku: string; nombre: string }>;
  porCategoria: Array<Metrics & { id: string; nombre: string }>;
  porModalidad: Array<Metrics & { tier: string }>;
}

const isoDay = (d: Date) => new Date(d.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
const field = 'rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700';
const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

function Table({ title, rows }: { title: string; rows: Array<{ key: string; label: string; m: Metrics }> }) {
  return (
    <section className="mt-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
      <h2 className="p-5 pb-2 text-sm font-semibold text-stone-700">{title}</h2>
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400">
          <tr><th className="px-4 py-2 text-left">Nombre</th><th className="text-right">Ingreso costeado</th><th className="text-right">Costo</th><th className="text-right">Utilidad bruta</th><th className="text-right">Margen</th><th className="text-right">Recargo</th><th className="px-4 text-right">Pendiente de costeo</th></tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-6 text-center text-stone-400">Sin ventas pagadas en el periodo.</td></tr> : rows.map(({ key, label, m }) => (
            <tr key={key}>
              <td className="px-4 py-2 font-medium text-stone-700">{label}</td>
              <td className="text-right">{formatCOP(m.ingreso)}</td><td className="text-right">{formatCOP(m.costo)}</td>
              <td className="text-right font-semibold text-wine">{formatCOP(m.utilidad)}</td>
              <td className="text-right">{pct(m.margenPct)}</td><td className="text-right">{pct(m.recargoPct)}</td>
              <td className="px-4 text-right text-amber-700">{m.ingresoPendienteCosteo > 0 ? `${formatCOP(m.ingresoPendienteCosteo)} (${m.unidadesPendientes} u.)` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function RentabilidadPage() {
  const [from, setFrom] = useState(`${isoDay(new Date()).slice(0, 8)}01`);
  const [to, setTo] = useState(isoDay(new Date()));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await request('GET', `/api/admin/finance/profitability?from=${from}&to=${to}`);
      if (!res.success) throw new Error(res.error?.message || 'No se pudo cargar la rentabilidad');
      setReport(res.data as Report);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = report ? [
    ['Ingreso costeado', formatCOP(report.resumen.ingreso)],
    ['Costo de mercancía vendida', formatCOP(report.resumen.costo)],
    ['Utilidad bruta', formatCOP(report.resumen.utilidad)],
    ['Margen bruto', pct(report.resumen.margenPct)],
    ['Recargo sobre costo', pct(report.resumen.recargoPct)],
    ['Comisiones causadas', formatCOP(report.resumen.comisionesCausadas)],
    ['Utilidad bruta − comisiones', formatCOP(report.resumen.utilidadDespuesDeComisiones)],
    ['Gastos operativos', formatCOP(report.resumen.gastosOperativos)],
    ['Resultado operativo estimado', formatCOP(report.resumen.resultadoOperativoEstimado)],
    ['Ingreso pendiente de costeo', formatCOP(report.resumen.ingresoPendienteCosteo)],
  ] : [];

  return (
    <div>
      <h1 className="mb-1 text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Rentabilidad</h1>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-stone-500">Desde<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={`${field} mt-1 block`} /></label>
        <label className="text-xs text-stone-500">Hasta<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={`${field} mt-1 block`} /></label>
      </div>
      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-wine" /></div> : null}
      {report && !loading ? (
        <>
          <ul className="mb-4 list-disc space-y-1 rounded-xl bg-amber-50 p-4 pl-8 text-xs text-amber-800">
            {report.notas.map((n) => <li key={n}>{n}</li>)}
          </ul>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {cards.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{label}</p>
                <p className="mt-2 text-xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>{value}</p>
              </div>
            ))}
          </div>
          <Table title="Por modalidad" rows={report.porModalidad.map((r) => ({ key: r.tier, label: TIER_LABELS[r.tier], m: r }))} />
          <Table title="Por categoría" rows={report.porCategoria.map((r) => ({ key: r.id, label: r.nombre, m: r }))} />
          <Table title="Por producto (top 100 por utilidad)" rows={report.porProducto.map((r) => ({ key: r.id, label: `${r.nombre} (${r.sku})`, m: r }))} />
        </>
      ) : null}
    </div>
  );
}
