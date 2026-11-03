'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { usePeriod } from '@/hooks/usePeriod';
import { formatInt, formatMoney, formatPct } from '@/lib/format';
import { KPI_DEFINITIONS } from '@/lib/kpi-definitions';
import PageHeader from '@/components/admin/PageHeader';
import PeriodSelector from '@/components/admin/PeriodSelector';
import KpiCard from '@/components/admin/KpiCard';
import HowCalculated from '@/components/admin/HowCalculated';
import { card, sectionTitle, th } from '@/components/admin/styles';

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

function Table({ title, rows }: { title: string; rows: Array<{ key: string; label: string; m: Metrics }> }) {
  return (
    <section className={`${card} mt-6 overflow-x-auto`}>
      <h2 className={`${sectionTitle} p-5 pb-3`}>{title}</h2>
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-stone-50">
          <tr>
            <th className={`${th} text-left`}>Nombre</th><th className={`${th} text-right`}>Ingresos cobrados</th><th className={`${th} text-right`}>Costo</th>
            <th className={`${th} text-right`}>Utilidad bruta</th><th className={`${th} text-right`}>Margen</th><th className={`${th} text-right`}>Recargo</th>
            <th className={`${th} text-right`}>Pendiente de costeo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 tabular-nums">
          {rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-6 text-center text-stone-600">Sin ventas pagadas en el periodo.</td></tr> : rows.map(({ key, label, m }) => (
            <tr key={key}>
              <td className="px-4 py-2.5 font-medium text-stone-800">{label}</td>
              <td className="px-4 py-2.5 text-right">{formatMoney(m.ingreso)}</td><td className="px-4 py-2.5 text-right">{formatMoney(m.costo)}</td>
              <td className="px-4 py-2.5 text-right font-semibold text-wine">{formatMoney(m.utilidad)}</td>
              <td className="px-4 py-2.5 text-right">{formatPct(m.margenPct)}</td><td className="px-4 py-2.5 text-right">{formatPct(m.recargoPct)}</td>
              <td className="px-4 py-2.5 text-right text-amber-800">{m.ingresoPendienteCosteo > 0 ? `${formatMoney(m.ingresoPendienteCosteo)} (${formatInt(m.unidadesPendientes)} u.)` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function RentabilidadPage() {
  const { period, setPeriod } = usePeriod();
  const { from, to } = period;
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

  const r = report?.resumen;

  return (
    <div>
      <PageHeader title="Rentabilidad" subtitle="Utilidad bruta sobre ingresos cobrados, por modalidad, categoría y producto.">
        <PeriodSelector period={period} onChange={setPeriod} />
      </PageHeader>
      {error ? <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-wine" aria-label="Cargando" /></div> : null}
      {report && r && !loading ? (
        <>
          <div className="mb-5"><HowCalculated rules={report.notas} /></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Ingresos cobrados" value={formatMoney(r.ingreso)} definition={KPI_DEFINITIONS.ingresoCobrado} />
            <KpiCard label="Costo de mercancía vendida" value={formatMoney(r.costo)} definition={KPI_DEFINITIONS.costoMercancia} />
            <KpiCard label="Utilidad bruta" value={formatMoney(r.utilidad)} definition={KPI_DEFINITIONS.utilidadBruta} tone="gold" />
            <KpiCard label="Margen bruto" value={formatPct(r.margenPct)} definition={KPI_DEFINITIONS.margenBruto} />
            <KpiCard label="Recargo sobre costo" value={formatPct(r.recargoPct)} definition={KPI_DEFINITIONS.recargo} />
            <KpiCard label="Comisiones causadas" value={formatMoney(r.comisionesCausadas)} definition={KPI_DEFINITIONS.comisionesCausadas} />
            <KpiCard label="Utilidad bruta − comisiones" value={formatMoney(r.utilidadDespuesDeComisiones)} definition={KPI_DEFINITIONS.utilidadMenosComisiones} />
            <KpiCard label="Gastos que afectan el resultado" value={formatMoney(r.gastosOperativos)} definition={KPI_DEFINITIONS.gastosQueAfectan} />
            <KpiCard label="Resultado operativo estimado" value={formatMoney(r.resultadoOperativoEstimado)} definition={KPI_DEFINITIONS.resultadoOperativo} tone="wine" />
            <KpiCard label="Pendiente de costeo" value={formatMoney(r.ingresoPendienteCosteo)} definition={KPI_DEFINITIONS.pendienteCosteo} />
          </div>
          <Table title="Por modalidad" rows={report.porModalidad.map((m) => ({ key: m.tier, label: TIER_LABELS[m.tier], m }))} />
          <Table title="Por categoría" rows={report.porCategoria.map((m) => ({ key: m.id, label: m.nombre, m }))} />
          <Table title="Por producto (top 100 por utilidad)" rows={report.porProducto.map((m) => ({ key: m.id, label: `${m.nombre} (${m.sku})`, m }))} />
        </>
      ) : null}
    </div>
  );
}
