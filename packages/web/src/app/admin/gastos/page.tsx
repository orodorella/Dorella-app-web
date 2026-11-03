'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { useToast } from '@/context/ToastProvider';
import { usePeriod } from '@/hooks/usePeriod';
import { deltaPct, formatMonth, formatPct } from '@/lib/format';
import { KPI_DEFINITIONS } from '@/lib/kpi-definitions';
import PageHeader from '@/components/admin/PageHeader';
import PeriodSelector from '@/components/admin/PeriodSelector';
import HowCalculated from '@/components/admin/HowCalculated';
import KpiCard from '@/components/admin/KpiCard';

interface Category { id: string; nombre: string; afectaResultado: boolean; isActive: boolean }
interface Expense {
  id: string; fecha: string; descripcion: string; valor: number; categoryId: string; categoria: string; afectaResultado: boolean;
  proveedor: string | null; medioPago: string | null; observaciones: string | null; soporteReferencia: string | null; anulado: boolean; motivoAnulacion: string | null;
}
interface Summary {
  total: number;
  porCategoria: Array<{ categoryId: string; categoria: string; total: number; registros: number; participacionPct: number | null; afectaResultado: boolean }>;
  mensual: Array<{ month: string; total: number }>;
  comparativoMensual: { mesActual: number; mesAnterior: number; variacionPct: number | null };
}

const isoDay = (d: Date) => new Date(d.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
const field = 'rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700';
const btn = 'cursor-pointer rounded-lg bg-wine px-4 py-2 text-xs font-semibold text-white hover:bg-wine-light disabled:opacity-50';
const RULES = [
  'Los gastos de categorías marcadas «no afecta resultado» (p. ej. flete ya incluido en el costo del producto) se registran pero no restan del resultado operativo.',
  'Un gasto no se borra: se anula con motivo y sale de los totales.',
  'La comparación usa el periodo equivalente: el mismo tramo del mes anterior si el mes está en curso.',
];
const emptyForm = { fecha: isoDay(new Date()), descripcion: '', valor: '', categoryId: '', proveedor: '', medioPago: '', observaciones: '', soporteReferencia: '' };

export default function GastosPage() {
  const { showToast } = useToast();
  const { period, setPeriod } = usePeriod();
  const { from, to, comparison } = period;
  const [compareTotal, setCompareTotal] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [q, setQ] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalValor, setTotalValor] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState({ nombre: '', afectaResultado: true });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ from, to, pageSize: '100' });
      if (categoryFilter) qs.set('categoryId', categoryFilter);
      if (q) qs.set('q', q);
      // El API no trae un comparativo alineado al periodo: se pide el resumen del periodo equivalente.
      const [c, l, s, prev] = await Promise.all([
        request('GET', '/api/admin/expenses/categories'),
        request('GET', `/api/admin/expenses?${qs}`),
        request('GET', `/api/admin/expenses/summary?from=${from}&to=${to}`),
        request('GET', `/api/admin/expenses/summary?from=${comparison.from}&to=${comparison.to}`),
      ]);
      setCompareTotal(prev.success ? Number((prev.data as Summary).total) : null);
      if (c.success) setCategories(c.data);
      if (l.success) { setExpenses(l.data); setTotalValor(Number(l.meta?.totalValor ?? 0)); }
      if (s.success) setSummary(s.data);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [from, to, comparison.from, comparison.to, categoryFilter, q, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function run(action: () => Promise<{ success: boolean; error?: { message?: string } }>, ok: string) {
    setBusy(true);
    try {
      const res = await action();
      if (!res.success) throw new Error(res.error?.message || 'No se pudo completar la acción');
      showToast(ok);
      await load();
      return true;
    } catch (err) {
      showToast((err as Error).message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    const res = await fetch(`/api/admin/expenses/export?from=${from}&to=${to}`, { credentials: 'include' });
    if (!res.ok) { showToast('No se pudo exportar', 'error'); return; }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url; a.download = `gastos-${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function startEdit(e: Expense) {
    setEditingId(e.id);
    setForm({
      fecha: e.fecha, descripcion: e.descripcion, valor: String(e.valor), categoryId: e.categoryId,
      proveedor: e.proveedor ?? '', medioPago: e.medioPago ?? '', observaciones: e.observaciones ?? '', soporteReferencia: e.soporteReferencia ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  // Al editar se incluye la categoría actual aunque esté desactivada.
  const activeCategories = categories.filter((c) => c.isActive || c.id === form.categoryId);

  return (
    <div>
      <PageHeader title="Gastos" subtitle="Registro de gastos operativos por categoría.">
        <PeriodSelector period={period} onChange={setPeriod} />
      </PageHeader>
      <div className="mb-6"><HowCalculated rules={RULES} /></div>

      <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-stone-700">{editingId ? 'Editar gasto' : 'Registrar gasto'}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="date" value={form.fecha} max={isoDay(new Date())} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={field} />
          <input type="number" min={0} step="0.01" placeholder="Valor COP" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className={field} />
          <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className={field}>
            <option value="">Categoría…</option>
            {activeCategories.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.afectaResultado ? '' : ' (no afecta resultado)'}</option>)}
          </select>
          <input placeholder="Proveedor o beneficiario" value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} className={field} />
          <input placeholder="Descripción" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className={`${field} sm:col-span-2`} />
          <input placeholder="Medio de pago" value={form.medioPago} onChange={(e) => setForm({ ...form, medioPago: e.target.value })} className={field} />
          <input placeholder="Soporte (n.º de factura o enlace)" value={form.soporteReferencia} onChange={(e) => setForm({ ...form, soporteReferencia: e.target.value })} className={field} />
          <input placeholder="Observaciones" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} className={`${field} sm:col-span-2 lg:col-span-3`} />
          <button
            disabled={busy || !form.descripcion || !form.valor || !form.categoryId} className={btn}
            onClick={async () => {
              const payload = { ...form, valor: Number(form.valor) };
              const ok = editingId
                ? await run(() => request('PUT', `/api/admin/expenses/${editingId}`, payload), 'Gasto actualizado')
                : await run(() => request('POST', '/api/admin/expenses', payload), 'Gasto registrado');
              if (ok) { setEditingId(null); setForm({ ...emptyForm, fecha: form.fecha }); }
            }}
          >
            {editingId ? 'Guardar cambios' : 'Registrar'}
          </button>
          {editingId ? <button onClick={cancelEdit} className="cursor-pointer text-xs text-stone-500 underline">Cancelar edición</button> : null}
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={field}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input placeholder="Buscar descripción o proveedor" value={q} onChange={(e) => setQ(e.target.value)} className={field} />
        <button onClick={exportCsv} className={btn}>Exportar CSV</button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-wine" /></div> : (
        <>
          {summary ? (
            <div className="mb-6 grid gap-4 lg:grid-cols-3">
              <KpiCard
                label="Gastos del periodo"
                value={formatCOP(summary.total)}
                tone="wine"
                definition={KPI_DEFINITIONS.gastosPeriodo}
                delta={{ pct: compareTotal === null ? null : deltaPct(summary.total, compareTotal), label: comparison.label, detail: comparison.rangeLabel }}
                hint={compareTotal !== null ? `Periodo comparado (${comparison.rangeLabel}): ${formatCOP(compareTotal)}` : undefined}
              />
              <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-2">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Por categoría</p>
                <ul className="space-y-1 text-sm">
                  {summary.porCategoria.length === 0 ? <li className="text-stone-400">Sin gastos en el periodo.</li> : summary.porCategoria.map((c) => (
                    <li key={c.categoryId} className="flex justify-between gap-3"><span>{c.categoria} <span className="text-xs text-stone-600">({c.registros})</span></span><span className="tabular-nums">{formatCOP(c.total)} · {formatPct(c.participacionPct ?? 0)}</span></li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-stone-400">Últimos meses: {summary.mensual.map((m) => `${formatMonth(m.month)}: ${formatCOP(m.total)}`).join(' · ')}</p>
              </div>
            </div>
          ) : null}

          <section className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400">
                <tr><th className="px-4 py-2 text-left">Fecha</th><th className="text-left">Descripción</th><th className="text-left">Categoría</th><th className="text-left">Proveedor</th><th className="text-right">Valor</th><th className="px-4" /></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {expenses.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-stone-400">Sin gastos en el periodo.</td></tr> : expenses.map((e) => (
                  <tr key={e.id} className={e.anulado ? 'text-stone-300 line-through' : ''}>
                    <td className="px-4 py-2">{e.fecha}</td>
                    <td>{e.descripcion}{e.soporteReferencia ? <span className="ml-1 text-xs text-stone-400">[{e.soporteReferencia}]</span> : null}</td>
                    <td>{e.categoria}</td><td>{e.proveedor ?? '—'}</td>
                    <td className="text-right font-medium">{formatCOP(e.valor)}</td>
                    <td className="px-4 text-right">
                      {e.anulado ? <span className="text-xs">Anulado</span> : (
                        <>
                        <button disabled={busy} className="mr-3 cursor-pointer text-xs text-wine underline" onClick={() => startEdit(e)}>Editar</button>
                        <button
                          disabled={busy} className="cursor-pointer text-xs text-red-600 underline"
                          onClick={() => { const motivo = window.prompt('Motivo de la anulación'); if (motivo) void run(() => request('POST', `/api/admin/expenses/${e.id}/void`, { motivo }), 'Gasto anulado'); }}
                        >
                          Anular
                        </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t border-stone-200"><td colSpan={4} className="px-4 py-2 text-right text-xs text-stone-500">Total vigente del filtro</td><td className="text-right font-semibold text-wine">{formatCOP(totalValor)}</td><td /></tr></tfoot>
            </table>
          </section>

          <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-stone-700">Categorías</h2>
            <ul className="mb-3 flex flex-wrap gap-2 text-sm">
              {categories.map((c) => (
                <li key={c.id} className={`flex items-center gap-2 rounded-full border px-3 py-1 ${c.isActive ? 'border-stone-200' : 'border-stone-100 text-stone-300'}`}>
                  {c.nombre}{c.afectaResultado ? '' : ' (no afecta resultado)'}
                  <button
                    disabled={busy} className="cursor-pointer text-xs underline"
                    onClick={() => { const nombre = window.prompt('Nuevo nombre de la categoría', c.nombre); if (nombre && nombre.trim() && nombre.trim() !== c.nombre) void run(() => request('PATCH', `/api/admin/expenses/categories/${c.id}`, { nombre: nombre.trim() }), 'Categoría renombrada'); }}
                  >
                    Renombrar
                  </button>
                  <button disabled={busy} className="cursor-pointer text-xs underline" onClick={() => run(() => request('PATCH', `/api/admin/expenses/categories/${c.id}`, { isActive: !c.isActive }), c.isActive ? 'Categoría desactivada' : 'Categoría activada')}>
                    {c.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <input placeholder="Nueva categoría" value={newCategory.nombre} onChange={(e) => setNewCategory({ ...newCategory, nombre: e.target.value })} className={field} />
              <label className="flex items-center gap-2 text-xs text-stone-600"><input type="checkbox" checked={newCategory.afectaResultado} onChange={(e) => setNewCategory({ ...newCategory, afectaResultado: e.target.checked })} /> Afecta el resultado operativo</label>
              <button disabled={busy || !newCategory.nombre.trim()} className={btn} onClick={async () => { if (await run(() => request('POST', '/api/admin/expenses/categories', newCategory), 'Categoría creada')) setNewCategory({ nombre: '', afectaResultado: true }); }}>Crear</button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
