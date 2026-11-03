'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, Receipt, Settings2 } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { useToast } from '@/context/ToastProvider';
import { usePeriod } from '@/hooks/usePeriod';
import { todayBogota } from '@/lib/admin-period';
import { deltaPct, formatDate, formatInt, formatMoney, formatMonth, formatPct } from '@/lib/format';
import { KPI_DEFINITIONS } from '@/lib/kpi-definitions';
import PageHeader from '@/components/admin/PageHeader';
import PeriodSelector from '@/components/admin/PeriodSelector';
import HowCalculated from '@/components/admin/HowCalculated';
import KpiCard from '@/components/admin/KpiCard';
import Dialog from '@/components/admin/Dialog';
import { btnDanger, btnPrimary, btnSecondary, btnSm, btnTertiary, card, field, fieldLabel, sectionTitle, th } from '@/components/admin/styles';

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
type Result = { success: boolean; error?: { message?: string } };

const RULES = [
  'Los gastos de categorías marcadas «no afecta resultado» (p. ej. flete ya incluido en el costo del producto) se registran pero no restan del resultado operativo.',
  'Un gasto no se borra: se anula con motivo y sale de los totales.',
  'La comparación usa el periodo equivalente: el mismo tramo del mes anterior si el mes está en curso.',
];
const emptyForm = () => ({ fecha: todayBogota(), descripcion: '', valor: '', categoryId: '', proveedor: '', medioPago: '', observaciones: '', soporteReferencia: '' });
const without = (record: Record<string, string>, key: string) => { const next = { ...record }; delete next[key]; return next; };

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
  const [renaming, setRenaming] = useState<Record<string, string>>({});
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [voiding, setVoiding] = useState<{ expense: Expense; motivo: string } | null>(null);
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

  async function run(action: () => Promise<Result>, ok: string) {
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
    setForm(emptyForm());
  }

  async function submitExpense(event: React.FormEvent) {
    event.preventDefault();
    const payload = { ...form, valor: Number(form.valor) };
    const ok = editingId
      ? await run(() => request('PUT', `/api/admin/expenses/${editingId}`, payload), 'Gasto actualizado')
      : await run(() => request('POST', '/api/admin/expenses', payload), 'Gasto registrado');
    if (ok) { setEditingId(null); setForm({ ...emptyForm(), fecha: form.fecha }); }
  }

  async function rename(c: Category) {
    const nombre = (renaming[c.id] ?? '').trim();
    if (!nombre || nombre === c.nombre) { setRenaming((r) => without(r, c.id)); return; }
    if (await run(() => request('PATCH', `/api/admin/expenses/categories/${c.id}`, { nombre }), 'Categoría renombrada')) setRenaming((r) => without(r, c.id));
  }

  // Al editar se incluye la categoría actual aunque esté desactivada.
  const activeCategories = categories.filter((c) => c.isActive || c.id === form.categoryId);
  const filtered = !!categoryFilter || !!q;
  // Un solo estado vacío para el periodo, en vez de repetirlo en el resumen, la lista y el detalle.
  const periodEmpty = !loading && !filtered && (summary?.total ?? 0) === 0 && expenses.length === 0;

  return (
    <div>
      <PageHeader
        title="Gastos"
        subtitle="Registro de gastos operativos por categoría."
        actions={(
          <>
            <button type="button" onClick={() => setCategoriesOpen(true)} className={btnSecondary}><Settings2 size={16} aria-hidden /> Gestionar categorías</button>
            <button type="button" onClick={exportCsv} className={btnSecondary}><Download size={16} aria-hidden /> Exportar CSV</button>
          </>
        )}
      >
        <PeriodSelector period={period} onChange={setPeriod} />
      </PageHeader>
      <div className="mb-6"><HowCalculated rules={RULES} /></div>

      <section className={`${card} mb-6 p-5`}>
        <h2 className={`${sectionTitle} mb-3`}>{editingId ? 'Editar gasto' : 'Registrar gasto'}</h2>
        <form onSubmit={submitExpense} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className={fieldLabel}>Fecha
            <input type="date" value={form.fecha} max={todayBogota()} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={`${field} mt-1 w-full`} />
          </label>
          <label className={fieldLabel}>Valor (COP)
            <input type="number" min={0} step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className={`${field} mt-1 w-full tabular-nums`} />
          </label>
          <label className={fieldLabel}>Categoría
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className={`${field} mt-1 w-full`}>
              <option value="">Selecciona…</option>
              {activeCategories.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.afectaResultado ? '' : ' (no afecta resultado)'}</option>)}
            </select>
          </label>
          <label className={fieldLabel}>Proveedor o beneficiario
            <input value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} className={`${field} mt-1 w-full`} />
          </label>
          <label className={`${fieldLabel} sm:col-span-2`}>Descripción
            <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className={`${field} mt-1 w-full`} />
          </label>
          <label className={fieldLabel}>Medio de pago
            <input value={form.medioPago} onChange={(e) => setForm({ ...form, medioPago: e.target.value })} className={`${field} mt-1 w-full`} />
          </label>
          <label className={fieldLabel}>Soporte
            <input placeholder="N.º de factura o enlace" value={form.soporteReferencia} onChange={(e) => setForm({ ...form, soporteReferencia: e.target.value })} className={`${field} mt-1 w-full`} />
          </label>
          <label className={`${fieldLabel} sm:col-span-2 lg:col-span-3`}>Observaciones
            <input value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} className={`${field} mt-1 w-full`} />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button type="submit" disabled={busy || !form.descripcion || !form.valor || !form.categoryId} className={`${btnPrimary} flex-1`}>
              {editingId ? 'Guardar cambios' : 'Registrar gasto'}
            </button>
            {editingId ? <button type="button" onClick={cancelEdit} className={btnTertiary}>Cancelar</button> : null}
          </div>
        </form>
      </section>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-wine" aria-label="Cargando" /></div> : periodEmpty ? (
        <div className={`${card} flex flex-col items-center gap-2 px-6 py-12 text-center`}>
          <Receipt size={28} className="text-stone-400" aria-hidden />
          <h2 className={sectionTitle}>Sin gastos entre {period.rangeLabel}</h2>
          <p className="max-w-md text-sm text-stone-700">
            Registra el primero con el formulario de arriba o elige otro periodo.
            {compareTotal ? ` En el periodo comparado (${comparison.rangeLabel}) hubo ${formatMoney(compareTotal)}.` : ''}
          </p>
        </div>
      ) : (
        <>
          {summary ? (
            <div className="mb-6 grid gap-4 lg:grid-cols-3">
              <KpiCard
                label="Gastos del periodo"
                value={formatMoney(summary.total)}
                tone="wine"
                definition={KPI_DEFINITIONS.gastosPeriodo}
                delta={{ pct: compareTotal === null ? null : deltaPct(summary.total, compareTotal), label: comparison.label, detail: comparison.rangeLabel }}
                hint={compareTotal !== null ? `Periodo comparado (${comparison.rangeLabel}): ${formatMoney(compareTotal)}` : undefined}
              />
              <div className={`${card} p-5 lg:col-span-2`}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-600">Por categoría</p>
                <ul className="space-y-1 text-sm">
                  {summary.porCategoria.map((c) => (
                    <li key={c.categoryId} className="flex justify-between gap-3">
                      <span>{c.categoria} <span className="text-xs text-stone-600">({formatInt(c.registros)})</span>{c.afectaResultado ? '' : <span className="ml-1 text-xs text-stone-600">· no afecta resultado</span>}</span>
                      <span className="tabular-nums">{formatMoney(c.total)} · {formatPct(c.participacionPct ?? 0)}</span>
                    </li>
                  ))}
                </ul>
                {summary.mensual.length ? <p className="mt-3 text-xs text-stone-600">Últimos meses: {summary.mensual.map((m) => `${formatMonth(m.month)}: ${formatMoney(m.total)}`).join(' · ')}</p> : null}
              </div>
            </div>
          ) : null}

          <section className={`${card} overflow-hidden`}>
            <div className="flex flex-wrap items-end gap-3 border-b border-stone-100 p-4">
              <label className={fieldLabel}>Categoría
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={`${field} mt-1 block`}>
                  <option value="">Todas</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
              <label className={`${fieldLabel} min-w-[14rem] flex-1 sm:flex-none`}>Buscar
                <input placeholder="Descripción o proveedor" value={q} onChange={(e) => setQ(e.target.value)} className={`${field} mt-1 block w-full sm:w-64`} />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-stone-50">
                  <tr><th className={`${th} text-left`}>Fecha</th><th className={`${th} text-left`}>Descripción</th><th className={`${th} text-left`}>Categoría</th><th className={`${th} text-left`}>Proveedor</th><th className={`${th} text-right`}>Valor</th><th className={`${th} text-right`}>Acciones</th></tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {expenses.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-600">Ningún gasto coincide con los filtros.</td></tr> : expenses.map((e) => (
                    <tr key={e.id} className={e.anulado ? 'text-stone-500' : ''}>
                      <td className="whitespace-nowrap px-4 py-2.5">{formatDate(e.fecha)}</td>
                      <td className="px-4 py-2.5"><span className={e.anulado ? 'line-through' : ''}>{e.descripcion}</span>{e.soporteReferencia ? <span className="ml-1 text-xs text-stone-600">[{e.soporteReferencia}]</span> : null}</td>
                      <td className="px-4 py-2.5">{e.categoria}</td><td className="px-4 py-2.5">{e.proveedor ?? '—'}</td>
                      <td className={`px-4 py-2.5 text-right font-medium tabular-nums ${e.anulado ? 'line-through' : ''}`}>{formatMoney(e.valor)}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {e.anulado ? <span className="text-xs" title={e.motivoAnulacion ?? undefined}>Anulado</span> : (
                            <>
                              <button type="button" disabled={busy} className={btnTertiary} onClick={() => startEdit(e)}>Editar</button>
                              <button type="button" disabled={busy} className={btnDanger} onClick={() => setVoiding({ expense: e, motivo: '' })}>Anular</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t border-stone-200"><td colSpan={4} className="px-4 py-2.5 text-right text-xs text-stone-600">Total vigente del filtro</td><td className="px-4 py-2.5 text-right font-semibold tabular-nums text-wine">{formatMoney(totalValor)}</td><td /></tr></tfoot>
              </table>
            </div>
          </section>
        </>
      )}

      <Dialog open={categoriesOpen} title="Categorías de gasto" variant="side" onClose={() => setCategoriesOpen(false)}>
        <p className="mb-4 text-stone-600">Las categorías desactivadas no aparecen al registrar gastos nuevos; sus gastos se conservan.</p>
        <ul className="mb-6 divide-y divide-stone-100">
          {categories.map((c) => (
            <li key={c.id} className="py-3">
              {renaming[c.id] !== undefined ? (
                <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void rename(c); }}>
                  <input autoFocus aria-label={`Nuevo nombre de ${c.nombre}`} value={renaming[c.id]} onChange={(e) => setRenaming({ ...renaming, [c.id]: e.target.value })} className={`${field} min-w-0 flex-1`} />
                  <button type="submit" disabled={busy} className={`${btnPrimary} ${btnSm}`}>Guardar</button>
                  <button type="button" className={btnTertiary} onClick={() => setRenaming((r) => without(r, c.id))}>Cancelar</button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className={c.isActive ? '' : 'text-stone-500'}>
                    <p className="font-medium">{c.nombre}</p>
                    <p className="text-xs text-stone-600">{c.afectaResultado ? 'Afecta el resultado' : 'No afecta el resultado'}{c.isActive ? '' : ' · desactivada'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" disabled={busy} className={btnTertiary} onClick={() => setRenaming({ ...renaming, [c.id]: c.nombre })}>Renombrar</button>
                    <button type="button" disabled={busy} className={c.isActive ? btnDanger : btnTertiary}
                      onClick={() => run(() => request('PATCH', `/api/admin/expenses/categories/${c.id}`, { isActive: !c.isActive }), c.isActive ? 'Categoría desactivada' : 'Categoría activada')}>
                      {c.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        <form
          className="space-y-3 rounded-xl border border-stone-200 bg-ivory p-4"
          onSubmit={async (e) => { e.preventDefault(); if (await run(() => request('POST', '/api/admin/expenses/categories', newCategory), 'Categoría creada')) setNewCategory({ nombre: '', afectaResultado: true }); }}
        >
          <h3 className="font-semibold text-stone-900">Nueva categoría</h3>
          <label className={`${fieldLabel} block`}>Nombre
            <input value={newCategory.nombre} onChange={(e) => setNewCategory({ ...newCategory, nombre: e.target.value })} className={`${field} mt-1 w-full`} />
          </label>
          <label className="flex items-start gap-2 text-sm text-stone-800">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-wine" checked={newCategory.afectaResultado} onChange={(e) => setNewCategory({ ...newCategory, afectaResultado: e.target.checked })} />
            <span>Afecta el resultado operativo<span className="block text-xs text-stone-600">Desmárcalo para gastos ya incluidos en el costo del producto (p. ej. flete de compra).</span></span>
          </label>
          <button type="submit" disabled={busy || !newCategory.nombre.trim()} className={btnPrimary}>Crear categoría</button>
        </form>
      </Dialog>

      <Dialog
        open={!!voiding}
        title="Anular gasto"
        size="sm"
        onClose={() => setVoiding(null)}
        footer={(
          <>
            <button type="button" className={btnSecondary} onClick={() => setVoiding(null)}>Cancelar</button>
            <button
              type="button" disabled={busy || !voiding?.motivo.trim()} className={btnPrimary}
              onClick={async () => {
                if (!voiding) return;
                const { expense, motivo } = voiding;
                if (await run(() => request('POST', `/api/admin/expenses/${expense.id}/void`, { motivo: motivo.trim() }), 'Gasto anulado')) setVoiding(null);
              }}
            >
              Anular gasto
            </button>
          </>
        )}
      >
        {voiding ? (
          <div className="space-y-3">
            <p>El gasto <strong>{voiding.expense.descripcion}</strong> por <strong>{formatMoney(voiding.expense.valor)}</strong> ({formatDate(voiding.expense.fecha)}) saldrá de los totales. No se borra: queda registrado como anulado.</p>
            <label className={`${fieldLabel} block`}>Motivo de la anulación
              <textarea rows={3} value={voiding.motivo} onChange={(e) => setVoiding({ ...voiding, motivo: e.target.value })} className={`${field} mt-1 w-full`} />
            </label>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
