'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { useToast } from '@/context/ToastProvider';

interface CostRow {
  id: string; sku: string; nombre: string; categoria: string; proveedor: string | null; precioVenta: number;
  costoAdquisicion: number | null; costoAdicional: number | null; costoTotal: number | null; costoActualizado: string | null;
  margenPct: number | null; recargoPct: number | null; utilidadUnitaria: number | null;
}

const field = 'rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700';
const btn = 'cursor-pointer rounded-lg bg-wine px-3 py-1.5 text-xs font-semibold text-white hover:bg-wine-light disabled:opacity-50';

export default function CostosPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<CostRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sinCosto, setSinCosto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { adq: string; adi: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: '20', search });
      if (sinCosto) qs.set('sinCosto', 'true');
      const res = await request('GET', `/api/admin/finance/costs/products?${qs}`);
      if (!res.success) throw new Error(res.error?.message || 'No se pudieron cargar los costos');
      setRows(res.data as CostRow[]);
      setPages(Math.max(1, Number(res.meta?.totalPages ?? 1)));
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, sinCosto, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save(row: CostRow) {
    const draft = drafts[row.id];
    if (!draft || draft.adq === '') return;
    setBusy(true);
    try {
      const res = await request('PUT', `/api/admin/finance/costs/products/${row.id}`, {
        costoAdquisicion: Number(draft.adq), costoAdicional: draft.adi === '' ? 0 : Number(draft.adi),
      });
      if (!res.success) throw new Error(res.error?.message || 'No se pudo guardar el costo');
      showToast('Costo guardado (el precio de venta no cambió)');
      setDrafts((d) => { const next = { ...d }; delete next[row.id]; return next; });
      await load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function backfill() {
    setBusy(true);
    try {
      const res = await request('POST', '/api/admin/finance/costs/backfill');
      if (!res.success) throw new Error(res.error?.message || 'No se pudo costear');
      showToast(`${res.data.updated} líneas históricas costeadas`);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Costos de productos</h1>
      <p className="mb-6 text-sm text-stone-400">
        Cada cambio crea un registro nuevo con fecha; las órdenes ya creadas conservan el costo que tenían. Editar un costo no cambia el precio público.
        Margen = utilidad / precio de venta; recargo = utilidad / costo (calculados sobre el precio de lista detal).
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Buscar por nombre, SKU o referencia" className={`${field} min-w-[260px]`} />
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" checked={sinCosto} onChange={(e) => { setPage(1); setSinCosto(e.target.checked); }} /> Solo sin costo
        </label>
        <button disabled={busy} onClick={backfill} className={btn} title="Costea líneas de órdenes antiguas usando el costo vigente en su fecha (requiere costos con fecha pasada)">
          Costear órdenes históricas
        </button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-wine" /></div> : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400">
              <tr>
                <th className="px-4 py-3 text-left">Producto</th><th className="text-right">Precio</th>
                <th className="text-right">Costo actual</th><th className="text-right">Margen</th><th className="text-right">Recargo</th>
                <th className="px-2 text-left">Nuevo costo adq.</th><th className="px-2 text-left">Adicional</th><th className="px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => {
                const draft = drafts[row.id] ?? { adq: '', adi: '' };
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3"><p className="font-medium text-stone-700">{row.nombre}</p><p className="text-xs text-stone-400">{row.sku} · {row.categoria}</p></td>
                    <td className="text-right">{formatCOP(row.precioVenta)}</td>
                    <td className="text-right">{row.costoTotal === null ? <span className="text-amber-600">Sin costo</span> : formatCOP(row.costoTotal)}
                      {row.costoActualizado ? <p className="text-[10px] text-stone-400">{row.costoActualizado.slice(0, 10)}</p> : null}</td>
                    <td className="text-right">{row.margenPct === null ? '—' : `${row.margenPct}%`}</td>
                    <td className="text-right">{row.recargoPct === null ? '—' : `${row.recargoPct}%`}</td>
                    <td className="px-2"><input type="number" min={0} step="0.01" value={draft.adq} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, adq: e.target.value } })} className={`${field} w-32`} /></td>
                    <td className="px-2"><input type="number" min={0} step="0.01" value={draft.adi} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, adi: e.target.value } })} className={`${field} w-28`} /></td>
                    <td className="px-4"><button disabled={busy || draft.adq === ''} onClick={() => save(row)} className={btn}>Guardar</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-3 text-sm">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="cursor-pointer disabled:opacity-40">Anterior</button>
        <span className="text-stone-500">{page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="cursor-pointer disabled:opacity-40">Siguiente</button>
      </div>
    </div>
  );
}
