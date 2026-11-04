'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, ChevronDown, Download, Loader2, MoreHorizontal } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { useToast } from '@/context/ToastProvider';
import { formatDate, formatMoney, formatPct } from '@/lib/format';
import PageHeader from '@/components/admin/PageHeader';
import HowCalculated from '@/components/admin/HowCalculated';
import InfoTip from '@/components/admin/InfoTip';
import ProgressBar from '@/components/admin/ProgressBar';
import Pager from '@/components/admin/Pager';
import Dialog from '@/components/admin/Dialog';
import { btnPrimary, btnSecondary, btnSm, card, field, fieldLabel, tableHead, th } from '@/components/admin/styles';

interface CostRow {
  id: string; sku: string; nombre: string; categoria: string; proveedor: string | null; precioVenta: number;
  costoAdquisicion: number | null; costoAdicional: number | null; costoTotal: number | null; costoActualizado: string | null;
  margenPct: number | null; recargoPct: number | null; utilidadUnitaria: number | null;
}
interface Meta { total: number; totalPages: number }

const RULES = [
  'Cada cambio crea un registro nuevo con fecha de hoy; las órdenes ya creadas conservan el costo que tenían.',
  'Editar un costo no cambia el precio público.',
  'Costo total = costo de adquisición + adicional. Margen = utilidad ÷ precio de venta; recargo = utilidad ÷ costo. Se calculan sobre el precio de lista detal.',
];
const HELP_ADQ = 'Costo de compra por unidad, sin el adicional. Al guardar se crea un nuevo registro de costo con fecha de hoy: no cambia el precio ni las órdenes anteriores.';
const HELP_ADI = 'Costos por unidad que se suman a la adquisición (empaque, baño, transporte del proveedor…). Vacío = 0. Costo total = adquisición + adicional.';
const PAGE_SIZES = [50, 100] as const;

const csvCell = (v: unknown) => {
  let text = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`; // evita fórmulas al abrir en Excel
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export default function CostosPage() {
  const { showToast } = useToast();
  const params = useSearchParams();
  const [rows, setRows] = useState<CostRow[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [search, setSearch] = useState('');
  const [sinCosto, setSinCosto] = useState(params.get('sinCosto') === '1');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { adq: string; adi: string }>>({});
  const [progress, setProgress] = useState<{ total: number; sinCosto: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmBackfill, setConfirmBackfill] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const adqInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const loadedOnce = useRef(false);

  const loadProgress = useCallback(async () => {
    const [all, missing] = await Promise.all([
      request('GET', '/api/admin/finance/costs/products?pageSize=1'),
      request('GET', '/api/admin/finance/costs/products?pageSize=1&sinCosto=true'),
    ]).catch(() => [null, null]);
    if (all?.success && missing?.success) setProgress({ total: Number(all.meta?.total ?? 0), sinCosto: Number(missing.meta?.total ?? 0) });
  }, []);

  const load = useCallback(async () => {
    // Tras la primera carga la tabla no se desmonta: así no se pierde el foco al guardar una fila.
    if (loadedOnce.current) setRefreshing(true); else setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize), search });
      if (sinCosto) qs.set('sinCosto', 'true');
      const res = await request('GET', `/api/admin/finance/costs/products?${qs}`);
      if (!res.success) throw new Error(res.error?.message || 'No se pudieron cargar los costos');
      setRows(res.data as CostRow[]);
      setMeta({ total: Number(res.meta?.total ?? 0), totalPages: Math.max(1, Number(res.meta?.totalPages ?? 1)) });
      loadedOnce.current = true;
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, pageSize, search, sinCosto, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => { void loadProgress(); }, [loadProgress]);

  async function save(row: CostRow, index: number) {
    const draft = drafts[row.id];
    if (!draft || draft.adq === '' || savingId) return;
    setSavingId(row.id);
    try {
      const res = await request('PUT', `/api/admin/finance/costs/products/${row.id}`, {
        costoAdquisicion: Number(draft.adq), costoAdicional: draft.adi === '' ? 0 : Number(draft.adi),
      });
      if (!res.success) throw new Error(res.error?.message || 'No se pudo guardar el costo');
      setDrafts((d) => { const next = { ...d }; delete next[row.id]; return next; });
      setSavedId(row.id);
      window.setTimeout(() => setSavedId((id) => (id === row.id ? null : id)), 2500);
      // Enter guarda y lleva a la fila siguiente para cargar costos en serie.
      adqInputs.current[rows[index + 1]?.id ?? '']?.focus();
      await Promise.all([load(), loadProgress()]);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSavingId(null);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>, row: CostRow, index: number) {
    if (e.key === 'Enter') { e.preventDefault(); void save(row, index); }
    if (e.key === 'Escape') setDrafts((d) => { const next = { ...d }; delete next[row.id]; return next; });
  }

  async function backfill() {
    setBusy(true);
    try {
      const res = await request('POST', '/api/admin/finance/costs/backfill');
      if (!res.success) throw new Error(res.error?.message || 'No se pudo costear');
      showToast(`${res.data.updated} líneas históricas costeadas`);
      setConfirmBackfill(false);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  /** Exporta todas las filas del filtro actual (mismo endpoint, de 100 en 100). Se abre en Excel. */
  async function exportCsv() {
    setExporting(true);
    try {
      const all: CostRow[] = [];
      for (let p = 1; ; p += 1) {
        const qs = new URLSearchParams({ page: String(p), pageSize: '100', search });
        if (sinCosto) qs.set('sinCosto', 'true');
        const res = await request('GET', `/api/admin/finance/costs/products?${qs}`);
        if (!res.success) throw new Error(res.error?.message || 'No se pudo exportar');
        all.push(...(res.data as CostRow[]));
        if (p >= Number(res.meta?.totalPages ?? 1)) break;
      }
      const header = ['SKU', 'Producto', 'Categoría', 'Proveedor', 'Precio venta', 'Costo adquisición', 'Costo adicional', 'Costo total', 'Costo vigente desde', 'Margen %', 'Recargo %'];
      const lines = all.map((r) => [r.sku, r.nombre, r.categoria, r.proveedor, r.precioVenta, r.costoAdquisicion, r.costoAdicional, r.costoTotal, r.costoActualizado?.slice(0, 10), r.margenPct, r.recargoPct].map(csvCell).join(';'));
      const blob = new Blob([`﻿${header.join(';')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = sinCosto ? 'costos-sin-costo.csv' : 'costos-productos.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Costos de productos"
        subtitle="Costo de adquisición y adicional por producto."
        actions={(
          <>
            <button type="button" onClick={exportCsv} disabled={exporting} className={btnSecondary}>
              {exporting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />} Exportar a Excel (CSV)
            </button>
            <div className="relative">
              <button type="button" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)} className={btnSecondary}>
                <MoreHorizontal size={16} aria-hidden /> Acciones <ChevronDown size={14} aria-hidden />
              </button>
              {menuOpen ? (
                <div role="menu" className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-stone-200 bg-white p-1 shadow-lg" onMouseLeave={() => setMenuOpen(false)}>
                  <button type="button" role="menuitem" className="w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-stone-800 hover:bg-wine-50"
                    onClick={() => { setMenuOpen(false); setConfirmBackfill(true); }}>
                    Costear órdenes históricas…
                    <span className="block text-xs text-stone-600">Asigna costo a líneas antiguas sin costo</span>
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      />
      <div className="mb-5"><HowCalculated rules={RULES} /></div>

      {progress ? (
        <div className={`${card} mb-5 p-4`}>
          <ProgressBar value={progress.total - progress.sinCosto} total={progress.total} label="Productos activos con costo" />
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className={`${fieldLabel} min-w-[16rem] flex-1 sm:flex-none`}>Buscar
          <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Nombre, SKU o referencia" className={`${field} mt-1 block w-full sm:w-72`} />
        </label>
        <label className={fieldLabel}>Por página
          <select value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }} className={`${field} mt-1 block`}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-stone-800">
          <input type="checkbox" className="h-4 w-4 accent-wine" checked={sinCosto} onChange={(e) => { setPage(1); setSinCosto(e.target.checked); }} /> Solo sin costo
        </label>
        {refreshing ? <span className="flex items-center gap-1 pb-2 text-xs text-stone-600"><Loader2 size={14} className="animate-spin" aria-hidden /> Actualizando…</span> : null}
      </div>

      <p className="mb-2 text-xs text-stone-600">Escribe el costo y pulsa <kbd className="rounded border border-stone-300 bg-white px-1">Enter</kbd> para guardar (pasa a la fila siguiente); <kbd className="rounded border border-stone-300 bg-white px-1">Tab</kbd> avanza de campo; <kbd className="rounded border border-stone-300 bg-white px-1">Esc</kbd> descarta.</p>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-wine" aria-label="Cargando" /></div> : (
        <div className={`${card} max-h-[70vh] overflow-auto`}>
          <table className="w-full min-w-[980px] text-sm">
            <thead className={tableHead}>
              <tr>
                <th className={`${th} text-left`}>Producto</th><th className={`${th} text-right`}>Precio</th>
                <th className={`${th} text-right`}>Costo actual</th><th className={`${th} text-right`}>Margen</th><th className={`${th} text-right`}>Recargo</th>
                <th className={`${th} text-left`}><span className="inline-flex items-center gap-1">Nuevo costo adq.<InfoTip label="Nuevo costo de adquisición" text={HELP_ADQ} /></span></th>
                <th className={`${th} text-left`}><span className="inline-flex items-center gap-1">Adicional<InfoTip label="Costo adicional" text={HELP_ADI} /></span></th>
                <th className={th}><span className="sr-only">Guardar</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 tabular-nums">
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-stone-600">{sinCosto ? 'Todos los productos de esta búsqueda ya tienen costo.' : 'No hay productos que coincidan con la búsqueda.'}</td></tr>
              ) : rows.map((row, index) => {
                const draft = drafts[row.id] ?? { adq: '', adi: '' };
                const dirty = draft.adq !== '' || draft.adi !== '';
                return (
                  <tr key={row.id} className={dirty ? 'bg-gold-50' : undefined}>
                    <td className="px-4 py-2.5"><p className="font-medium text-stone-900">{row.nombre}</p><p className="text-xs text-stone-600">{row.sku} · {row.categoria}</p></td>
                    <td className="px-4 py-2.5 text-right">{formatMoney(row.precioVenta)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {row.costoTotal === null ? <span className="font-medium text-amber-800">Sin costo</span> : formatMoney(row.costoTotal)}
                      {row.costoActualizado ? <span className="block text-xs text-stone-600">{formatDate(row.costoActualizado)}</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-right">{formatPct(row.margenPct)}</td>
                    <td className="px-4 py-2.5 text-right">{formatPct(row.recargoPct)}</td>
                    <td className="px-2 py-2">
                      <input
                        ref={(el) => { adqInputs.current[row.id] = el; }}
                        type="number" min={0} step="0.01" inputMode="decimal" aria-label={`Nuevo costo de adquisición de ${row.nombre}`}
                        placeholder={row.costoAdquisicion !== null ? String(row.costoAdquisicion) : ''}
                        value={draft.adq} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, adq: e.target.value } })}
                        onKeyDown={(e) => onKeyDown(e, row, index)} className={`${field} w-32 tabular-nums`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number" min={0} step="0.01" inputMode="decimal" aria-label={`Costo adicional de ${row.nombre}`}
                        placeholder={row.costoAdicional !== null ? String(row.costoAdicional) : ''}
                        value={draft.adi} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, adi: e.target.value } })}
                        onKeyDown={(e) => onKeyDown(e, row, index)} className={`${field} w-28 tabular-nums`}
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      {savedId === row.id ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check size={14} aria-hidden /> Guardado</span>
                      ) : (
                        // Fuera del orden de tabulación para que Tab pase de "Adicional" a la fila siguiente; Enter hace lo mismo.
                        <button type="button" tabIndex={-1} disabled={draft.adq === '' || savingId !== null} onClick={() => save(row, index)} className={`${btnPrimary} ${btnSm}`}>
                          {savingId === row.id ? 'Guardando…' : 'Guardar'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pager page={page} totalPages={meta.totalPages} total={meta.total} totalLabel="productos" onChange={setPage} />
        </div>
      )}

      <Dialog
        open={confirmBackfill}
        title="Costear órdenes históricas"
        onClose={() => setConfirmBackfill(false)}
        footer={(
          <>
            <button type="button" className={btnSecondary} onClick={() => setConfirmBackfill(false)}>Cancelar</button>
            <button type="button" disabled={busy} className={btnPrimary} onClick={backfill}>{busy ? 'Costeando…' : 'Costear líneas sin costo'}</button>
          </>
        )}
      >
        <div className="space-y-3">
          <p>Asigna costo a las <strong>líneas de órdenes ya registradas que no tienen costo</strong>, usando el último costo del producto vigente en la fecha de cada orden.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Solo se costean líneas cuyo producto tenía un costo con fecha <strong>anterior</strong> a la orden. Un costo cargado hoy no aplica a órdenes pasadas.</li>
            <li>No cambia precios, totales, pagos ni líneas que ya tienen costo.</li>
            <li>Cambia la utilidad y la rentabilidad reportadas de periodos pasados.</li>
            <li>No se puede deshacer desde el panel; queda registrado en la auditoría.</li>
          </ul>
        </div>
      </Dialog>
    </div>
  );
}
