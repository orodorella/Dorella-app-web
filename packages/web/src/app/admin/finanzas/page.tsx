'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { request } from '@/hooks/useApi';
import { usePeriod } from '@/hooks/usePeriod';
import { useToast } from '@/context/ToastProvider';
import { deltaPct, formatInt, formatMoney, formatMoneyCompact, formatPct } from '@/lib/format';
import { KPI_DEFINITIONS } from '@/lib/kpi-definitions';
import PageHeader from '@/components/admin/PageHeader';
import PeriodSelector from '@/components/admin/PeriodSelector';
import KpiCard, { type KpiDelta } from '@/components/admin/KpiCard';
import HowCalculated from '@/components/admin/HowCalculated';
import SetupChecklist from '@/components/admin/SetupChecklist';
import { btnSecondary, card, CHART_AXIS_TICK, CHART_GRID, sectionTitle } from '@/components/admin/styles';

const TIER_LABELS: Record<string, string> = { detal: 'Detal', por_mayor: 'Por mayor', gran_mayor: 'Gran mayor' };

interface Dashboard {
  from: string; to: string;
  ventas: { total: number; ordenes: number; ticketPromedio: number; variacionPct: number | null;
    porComercial: Array<{ sellerId: string; nombre: string; ventas: number; ordenes: number; participacionPct: number | null }>;
    porModalidad: Array<{ tier: string; revenue: number; units: number }> };
  rentabilidad: { ingresoCobradoCosteado: number; costoMercanciaVendida: number; utilidadBruta: number; margenBrutoPct: number | null; ingresoPendienteCosteo: number };
  comisiones: { causadasEnPeriodo: number; porPagar: number };
  gastos: { total: number; porCategoria: Array<{ categoria: string; total: number }> };
  inventario?: { unidadesSinValorar: number };
  resultadoOperativoEstimado: number;
  advertencias: string[];
}

const RULES = [
  'Ventas cuenta órdenes no canceladas, cobradas o no. Utilidad, comisiones y gastos se calculan sobre los ingresos cobrados (pago aprobado) del mismo periodo.',
  'Las ventas sin costo registrado quedan en «Pendiente de costeo» y no entran en la utilidad.',
  'Las compras de inventario no restan del resultado: el costo entra cuando se vende.',
];
// El API mezcla reglas fijas y avisos sobre los datos; los avisos ("Hay …") se destacan aparte.
const isDataWarning = (text: string) => /^Hay /.test(text);

export default function FinanzasPage() {
  const { showToast } = useToast();
  const { period, setPeriod, withPeriod } = usePeriod();
  const { from, to, comparison } = period;
  const [data, setData] = useState<Dashboard | null>(null);
  const [compareVentas, setCompareVentas] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Mes en curso o mes pasado: se compara contra el tramo equivalente, no contra los días inmediatamente anteriores.
      const [res, prev] = await Promise.all([
        request('GET', `/api/admin/finance/summary?from=${from}&to=${to}`),
        comparison.matchesApi ? Promise.resolve(null) : request('GET', `/api/admin/finance/summary?from=${comparison.from}&to=${comparison.to}`),
      ]);
      if (!res.success) throw new Error(res.error?.message || 'No se pudo cargar el resumen');
      setData(res.data as Dashboard);
      setCompareVentas(prev?.success ? (prev.data as Dashboard).ventas.total : null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [from, to, comparison.matchesApi, comparison.from, comparison.to]);

  useEffect(() => { void load(); }, [load]);

  async function exportCsv() {
    const res = await fetch(`/api/admin/finance/summary/export?from=${from}&to=${to}`, { credentials: 'include' });
    if (!res.ok) { showToast('No se pudo exportar', 'error'); return; }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url; a.download = `resumen-financiero-${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const pendiente = data?.rentabilidad.ingresoPendienteCosteo ?? 0;
  // Sin ningún ingreso costeado pero con cobros pendientes de costo: la utilidad no es $0, es desconocida.
  const sinCosto = !!data && data.rentabilidad.ingresoCobradoCosteado === 0 && pendiente > 0;

  const ventasDelta: KpiDelta | undefined = data ? {
    pct: comparison.matchesApi ? data.ventas.variacionPct : compareVentas === null ? null : deltaPct(data.ventas.total, compareVentas),
    label: comparison.label,
    detail: comparison.rangeLabel,
  } : undefined;

  return (
    <div>
      <PageHeader
        title="Resumen financiero"
        subtitle="Visión general del periodo. Solo administrador."
        actions={<button type="button" onClick={exportCsv} className={btnSecondary}><Download size={16} aria-hidden /> Exportar CSV</button>}
      >
        <PeriodSelector period={period} onChange={setPeriod} />
      </PageHeader>

      {error ? <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-wine" aria-label="Cargando" /></div> : null}

      {data && !loading ? (
        <>
          <div className="mb-5">
            <HowCalculated rules={[...RULES, ...data.advertencias.filter((a) => !isDataWarning(a))]} warnings={data.advertencias.filter(isDataWarning)} />
          </div>

          <SetupChecklist from={from} to={to} unidadesSinValorar={data.inventario?.unidadesSinValorar} pendienteCosteo={data.rentabilidad.ingresoPendienteCosteo} />

          {/* Visión general: cada tarjeta lleva a su pantalla de detalle con el mismo periodo. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard label="Ventas" value={formatMoney(data.ventas.total)} definition={KPI_DEFINITIONS.ventas} delta={ventasDelta} href={withPeriod('/admin/rendimiento')}
              hint={`${formatInt(data.ventas.ordenes)} órdenes · ticket ${formatMoney(data.ventas.ticketPromedio)} · ver rendimiento comercial`} />
            <KpiCard label="Utilidad bruta" value={formatMoney(data.rentabilidad.utilidadBruta)} definition={KPI_DEFINITIONS.utilidadBruta} tone="gold" href={withPeriod('/admin/rentabilidad')}
              missing={sinCosto ? 'Falta costo' : null}
              hint={sinCosto
                ? `${formatMoney(pendiente)} cobrados sin costo registrado · ver rentabilidad`
                : `${data.rentabilidad.margenBrutoPct !== null ? `Margen bruto ${formatPct(data.rentabilidad.margenBrutoPct)}` : 'Sin ventas cobradas'}${pendiente > 0 ? ` · parcial: ${formatMoney(pendiente)} sin costo` : ''} · ver rentabilidad`} />
            <KpiCard label="Resultado operativo estimado" value={formatMoney(data.resultadoOperativoEstimado)} definition={KPI_DEFINITIONS.resultadoOperativo} tone="wine"
              missing={sinCosto ? 'Falta costo' : null}
              hint={`Utilidad bruta − comisiones causadas (${formatMoney(data.comisiones.causadasEnPeriodo)}) − gastos que afectan el resultado`} />
            <KpiCard label="Comisiones por pagar" value={formatMoney(data.comisiones.porPagar)} definition={KPI_DEFINITIONS.comisionesPorPagar} href={withPeriod('/admin/comisiones')}
              hint={`Causadas en el periodo: ${formatMoney(data.comisiones.causadasEnPeriodo)} · ver liquidaciones`} />
            <KpiCard label="Gastos registrados" value={formatMoney(data.gastos.total)} definition={KPI_DEFINITIONS.gastosOperativos} href={withPeriod('/admin/gastos')}
              hint="Ver gastos por categoría" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className={`${card} min-w-0 p-5`}>
              <h2 className={`${sectionTitle} mb-3`}>Ventas por comercial</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.ventas.porComercial}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="nombre" tick={CHART_AXIS_TICK} />
                  <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => formatMoneyCompact(Number(v))} width={72} />
                  <Tooltip formatter={(v) => formatMoney(Number(v))} />
                  <Bar dataKey="ventas" name="Ventas" fill="#5B0E16" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
            <section className={`${card} min-w-0 p-5`}>
              <h2 className={`${sectionTitle} mb-3`}>Ventas por modalidad</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.ventas.porModalidad.map((t) => ({ ...t, label: TIER_LABELS[t.tier] }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="label" tick={CHART_AXIS_TICK} />
                  <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => formatMoneyCompact(Number(v))} width={72} />
                  <Tooltip formatter={(v) => formatMoney(Number(v))} />
                  <Bar dataKey="revenue" name="Ventas" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>

          <section className={`${card} mt-6 p-5`}>
            <h2 className={`${sectionTitle} mb-3`}>Mayores categorías de gasto</h2>
            <ul className="space-y-1 text-sm">
              {data.gastos.porCategoria.length === 0 ? <li className="text-stone-600">Sin gastos en el periodo.</li> : data.gastos.porCategoria.map((c) => (
                <li key={c.categoria} className="flex justify-between"><span>{c.categoria}</span><span className="tabular-nums">{formatMoney(c.total)}</span></li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
