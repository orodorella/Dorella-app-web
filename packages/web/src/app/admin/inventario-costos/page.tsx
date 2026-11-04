'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowDownWideNarrow, Loader2 } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { useToast } from '@/context/ToastProvider';
import { usePeriod } from '@/hooks/usePeriod';
import { formatDate, formatInt, formatMoney } from '@/lib/format';
import { todayBogota } from '@/lib/admin-period';
import { KPI_DEFINITIONS } from '@/lib/kpi-definitions';
import PageHeader from '@/components/admin/PageHeader';
import PeriodSelector from '@/components/admin/PeriodSelector';
import HowCalculated from '@/components/admin/HowCalculated';
import KpiCard from '@/components/admin/KpiCard';
import Pager from '@/components/admin/Pager';
import Dialog from '@/components/admin/Dialog';
import { btnPrimary, btnTertiary, card, field, fieldLabel, sectionTitle, tableHead, th } from '@/components/admin/styles';

interface ProductOption { id: string; sku: string; nombre: string }
interface ValuationRow {
  id: string; sku: string; nombre: string; stock: number; unidadesValoradas: number; unidadesSinValorar: number;
  valorizado: number; costoPromedio: number | null; lotesActivos: number; valoracionExcedeStock: boolean;
}
interface Valuation {
  resumen: { comprasPeriodo: number; unidadesCompradasPeriodo: number; inventarioValorizado: number; unidadesValoradas: number; unidadesSinValorar: number; costoPromedioUnitario: number | null; productosConValoracionMayorAlStock: number };
  notas: string[];
  productos: ValuationRow[];
}
interface History {
  lotes: Array<{ id: string; tipo: string; fechaCompra: string; proveedor: string | null; referencia: string | null; cantidad: number; cantidadRestante: number; costoUnitario: number; gastosAdicionales: number; costoEfectivo: number }>;
  movimientos: Array<{ id: string; tipo: string; cantidad: number; costoUnitario: number | null; motivo: string | null; fecha: string }>;
}
type Tipo = 'compra' | 'valoracion_inicial';

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const emptyForm = () => ({ tipo: 'compra' as Tipo, cantidad: '', costoUnitario: '', gastosAdicionales: '', proveedor: '', fechaCompra: todayBogota(), referencia: '', observaciones: '' });
const RULES = [
  'Cada compra conserva su costo; las ventas consumen los lotes más antiguos primero (FIFO).',
  'Una compra suma el stock una sola vez: no vuelvas a sumar esas unidades por otra vía.',
  'Los gastos adicionales de una compra (flete…) se reparten entre sus unidades y forman parte de su costo; no los registres también como gasto operativo.',
  'El periodo solo afecta «Compras del periodo»; el inventario valorizado es a hoy.',
];
const MOV_LABELS: Record<string, string> = { compra: 'Compra', valoracion_inicial: 'Valoración inicial', venta: 'Venta', devolucion: 'Devolución', ajuste: 'Ajuste' };
const TIPOS: Array<{ id: Tipo; label: string; help: string }> = [
  { id: 'compra', label: 'Compra (suma stock)', help: 'Mercancía nueva que llegó: suma las unidades al stock y crea un lote con su costo.' },
  { id: 'valoracion_inicial', label: 'Valoración inicial (no suma stock)', help: 'Pone costo a unidades que ya estaban en stock sin costo. No cambia el stock.' },
];
const PAGE_SIZE = 50;

export default function InventarioCostosPage() {
  const { showToast } = useToast();
  const params = useSearchParams();
  const { period, setPeriod } = usePeriod();
  const { from, to } = period;
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [product, setProduct] = useState<ProductOption | null>(null);
  const [form, setForm] = useState(emptyForm);
  // Una clave por formulario: reenviar o hacer doble clic no duplica la compra ni el stock.
  const idempotencyKey = useRef(newKey());
  const [history, setHistory] = useState<{ producto: string; data: History } | null>(null);
  // Tabla: búsqueda, filtro y orden en el navegador (el API devuelve la valoración completa de una vez).
  const [tableSearch, setTableSearch] = useState('');
  const [onlyUnvalued, setOnlyUnvalued] = useState(params.get('sinValorar') === '1');
  const [sortUnvalued, setSortUnvalued] = useState(params.get('sinValorar') === '1');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request('GET', `/api/admin/finance/inventory/valuation?from=${from}&to=${to}`);
      if (!res.success) throw new Error(res.error?.message || 'No se pudo cargar la valoración');
      setValuation(res.data as Valuation);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [from, to, showToast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (product || search.trim().length < 2) { setOptions([]); return undefined; }
    const timer = window.setTimeout(async () => {
      const res = await request('GET', `/api/admin/finance/costs/products?search=${encodeURIComponent(search.trim())}&pageSize=8`).catch(() => null);
      if (res?.success) setOptions(res.data as ProductOption[]);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, product]);

  const rows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    let list = valuation?.productos ?? [];
    if (q) list = list.filter((p) => p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    if (onlyUnvalued) list = list.filter((p) => p.unidadesSinValorar > 0);
    if (sortUnvalued) list = [...list].sort((a, b) => b.unidadesSinValorar - a.unidadesSinValorar);
    return list;
  }, [valuation, tableSearch, onlyUnvalued, sortUnvalued]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [tableSearch, onlyUnvalued, sortUnvalued, valuation]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!product) return;
    setBusy(true);
    try {
      const res = await request('POST', '/api/admin/finance/inventory/purchases', {
        productId: product.id, tipo: form.tipo, cantidad: Number(form.cantidad), costoUnitario: Number(form.costoUnitario),
        gastosAdicionales: form.gastosAdicionales === '' ? 0 : Number(form.gastosAdicionales),
        proveedor: form.proveedor, fechaCompra: form.fechaCompra, referencia: form.referencia, observaciones: form.observaciones,
        idempotencyKey: idempotencyKey.current,
      });
      if (!res.success) throw new Error(res.error?.message || 'No se pudo registrar');
      showToast(res.data.duplicado ? 'Esta compra ya estaba registrada (no se duplicó)' : form.tipo === 'compra' ? 'Compra registrada y stock actualizado' : 'Existencias valoradas');
      setForm(emptyForm());
      setProduct(null);
      setSearch('');
      idempotencyKey.current = newKey();
      await load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function openHistory(row: ValuationRow) {
    const res = await request('GET', `/api/admin/finance/inventory/products/${row.id}/history`).catch(() => null);
    if (res?.success) setHistory({ producto: `${row.nombre} (${row.sku})`, data: res.data as History });
    else showToast('No se pudo cargar el historial', 'error');
  }

  const r = valuation?.resumen;
  const tipo = TIPOS.find((t) => t.id === form.tipo) ?? TIPOS[0];

  return (
    <div>
      <PageHeader title="Compras e inventario valorizado" subtitle="Registra compras, valora existencias y consulta el costo del inventario." />
      <div className="mb-6"><HowCalculated rules={RULES} /></div>

      <section className={`${card} mb-6 p-5`}>
        <h2 className={`${sectionTitle} mb-3`}>Registrar compra o valorar existencias</h2>
        <form onSubmit={submit} className="space-y-4">
          <fieldset>
            <legend className={`${fieldLabel} mb-1.5`}>Tipo de registro</legend>
            <div role="radiogroup" aria-label="Tipo de registro" className="inline-flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1">
              {TIPOS.map((t) => (
                <button
                  key={t.id} type="button" role="radio" aria-checked={form.tipo === t.id}
                  onClick={() => setForm({ ...form, tipo: t.id })}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${form.tipo === t.id ? 'bg-wine text-white shadow-sm' : 'text-stone-700 hover:bg-white hover:text-wine'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-stone-700">{tipo.help}</p>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2">
              <span className={fieldLabel}>Producto</span>
              {product ? (
                <div className="mt-1 flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50/60 px-3 py-2 text-sm">
                  <span>{product.nombre} <span className="text-stone-600">({product.sku})</span></span>
                  <button type="button" className={btnTertiary} onClick={() => { setProduct(null); setSearch(''); }}>Cambiar</button>
                </div>
              ) : (
                <>
                  <input aria-label="Producto" placeholder="Buscar producto por nombre o SKU" value={search} onChange={(e) => setSearch(e.target.value)} className={`${field} mt-1 w-full`} />
                  {options.length > 0 ? (
                    <ul className="absolute z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
                      {options.map((o) => (
                        <li key={o.id}><button type="button" className="w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-champagne/40" onClick={() => { setProduct(o); setOptions([]); }}>{o.nombre} <span className="text-stone-600">({o.sku})</span></button></li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </div>
            <label className={fieldLabel}>Fecha de compra
              <input type="date" value={form.fechaCompra} max={todayBogota()} onChange={(e) => setForm({ ...form, fechaCompra: e.target.value })} className={`${field} mt-1 w-full`} />
            </label>
            <label className={fieldLabel}>Cantidad
              <input type="number" min={1} step={1} required value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} className={`${field} mt-1 w-full tabular-nums`} />
            </label>
            <label className={fieldLabel}>Costo unitario (COP)
              <input type="number" min={0} step="0.01" required value={form.costoUnitario} onChange={(e) => setForm({ ...form, costoUnitario: e.target.value })} className={`${field} mt-1 w-full tabular-nums`} />
            </label>
            <label className={fieldLabel}>Gastos adicionales de la compra
              <input type="number" min={0} step="0.01" placeholder="Flete, empaque… (opcional)" value={form.gastosAdicionales} onChange={(e) => setForm({ ...form, gastosAdicionales: e.target.value })} className={`${field} mt-1 w-full tabular-nums`} />
            </label>
            <label className={fieldLabel}>Proveedor
              <input value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} className={`${field} mt-1 w-full`} />
            </label>
            <label className={fieldLabel}>Referencia o factura
              <input placeholder="Opcional" value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} className={`${field} mt-1 w-full`} />
            </label>
            <label className={`${fieldLabel} sm:col-span-2 lg:col-span-3`}>Observaciones
              <input value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} className={`${field} mt-1 w-full`} />
            </label>
            <div className="flex items-end">
              <button type="submit" disabled={busy || !product || !form.cantidad || form.costoUnitario === ''} className={`${btnPrimary} w-full`}>
                {busy ? 'Guardando…' : form.tipo === 'compra' ? 'Registrar compra' : 'Valorar existencias'}
              </button>
            </div>
          </div>
          <p className="text-xs text-stone-600">Los gastos adicionales se reparten entre las unidades de esta compra y forman parte de su costo; no los registres también como gasto operativo.</p>
        </form>
      </section>

      <div className="mb-4">
        <PeriodSelector period={period} onChange={setPeriod} note="El periodo solo afecta «Compras del periodo»." />
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-wine" aria-label="Cargando" /></div> : valuation && r ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Compras del periodo" value={formatMoney(r.comprasPeriodo)} definition={KPI_DEFINITIONS.comprasPeriodo} hint={`${formatInt(r.unidadesCompradasPeriodo)} unidades`} />
            <KpiCard label="Inventario valorizado" value={formatMoney(r.inventarioValorizado)} definition={KPI_DEFINITIONS.inventarioValorizado} hint={`${formatInt(r.unidadesValoradas)} unidades valoradas`} />
            <KpiCard label="Costo promedio unitario" value={formatMoney(r.costoPromedioUnitario)} definition={KPI_DEFINITIONS.costoPromedio} />
            <KpiCard label="Unidades sin valorar" value={formatInt(r.unidadesSinValorar)} definition={KPI_DEFINITIONS.unidadesSinValorar} tone={r.unidadesSinValorar > 0 ? 'gold' : 'default'} />
          </div>
          {r.productosConValoracionMayorAlStock > 0 ? (
            <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{formatInt(r.productosConValoracionMayorAlStock)} producto(s) tienen más unidades valoradas que stock físico: revisa ajustes de stock o lotes.</p>
          ) : null}

          <section className={`${card} mt-6`}>
            <div className="flex flex-wrap items-end gap-3 border-b border-stone-100 p-4">
              <label className={`${fieldLabel} min-w-[14rem] flex-1 sm:flex-none`}>Buscar en la tabla
                <input value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder="Nombre o SKU" className={`${field} mt-1 block w-full sm:w-64`} />
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm text-stone-800">
                <input type="checkbox" className="h-4 w-4 accent-wine" checked={onlyUnvalued} onChange={(e) => setOnlyUnvalued(e.target.checked)} /> Sin valorar
              </label>
              <button type="button" aria-pressed={sortUnvalued} onClick={() => setSortUnvalued((s) => !s)}
                className={`mb-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${sortUnvalued ? 'border-wine bg-wine-50 text-wine' : 'border-stone-300 text-stone-700 hover:border-wine/40'}`}>
                <ArrowDownWideNarrow size={16} aria-hidden /> Más unidades sin valorar primero
              </button>
              <span className="pb-2 text-xs text-stone-600">{formatInt(rows.length)} de {formatInt(valuation.productos.length)} productos</span>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className={tableHead}>
                  <tr>
                    <th className={`${th} text-left`}>Producto</th><th className={`${th} text-right`}>Stock</th><th className={`${th} text-right`}>Valoradas</th>
                    <th className={`${th} text-right`} aria-sort={sortUnvalued ? 'descending' : 'none'}>Sin valorar</th><th className={`${th} text-right`}>Costo prom.</th><th className={`${th} text-right`}>Valorizado</th>
                    <th className={th}><span className="sr-only">Historial</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 tabular-nums">
                  {pageRows.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-stone-600">{onlyUnvalued ? 'No hay productos con unidades sin valorar.' : 'Ningún producto coincide con la búsqueda.'}</td></tr>
                  ) : pageRows.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2.5"><p className="font-medium text-stone-900">{p.nombre}</p><p className="text-xs text-stone-600">{p.sku} · {formatInt(p.lotesActivos)} lote(s)</p></td>
                      <td className="px-4 py-2.5 text-right">{formatInt(p.stock)}</td>
                      <td className="px-4 py-2.5 text-right">{formatInt(p.unidadesValoradas)}{p.valoracionExcedeStock ? <span className="ml-1 text-amber-800" title="Más unidades valoradas que stock">⚠</span> : null}</td>
                      <td className={`px-4 py-2.5 text-right ${p.unidadesSinValorar > 0 ? 'font-semibold text-amber-800' : ''}`}>{formatInt(p.unidadesSinValorar)}</td>
                      <td className="px-4 py-2.5 text-right">{formatMoney(p.costoPromedio)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-wine">{formatMoney(p.valorizado)}</td>
                      <td className="px-4 py-2 text-right"><button type="button" className={btnTertiary} onClick={() => openHistory(p)}>Historial</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} totalPages={totalPages} total={rows.length} totalLabel="productos" onChange={setPage} />
          </section>
          {valuation.notas.length ? <div className="mt-4"><HowCalculated rules={valuation.notas} /></div> : null}
        </>
      ) : null}

      <Dialog open={!!history} title={history ? `Historial · ${history.producto}` : ''} onClose={() => setHistory(null)} size="lg">
        {history ? (
          <>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-stone-600">Lotes</h3>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm tabular-nums">
                <thead className="text-xs text-stone-600"><tr><th className="py-1 text-left">Fecha</th><th className="text-left">Proveedor / ref.</th><th className="text-right">Compra</th><th className="text-right">Restante</th><th className="text-right">Costo efectivo</th></tr></thead>
                <tbody>{history.data.lotes.map((l) => (
                  <tr key={l.id} className="border-t border-stone-100"><td className="py-1.5">{formatDate(l.fechaCompra)}{l.tipo === 'valoracion_inicial' ? ' (inicial)' : ''}</td><td>{[l.proveedor, l.referencia].filter(Boolean).join(' · ') || '—'}</td><td className="text-right">{formatInt(l.cantidad)}</td><td className="text-right">{formatInt(l.cantidadRestante)}</td><td className="text-right">{formatMoney(l.costoEfectivo)}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-stone-600">Movimientos</h3>
            <ul className="space-y-1 text-sm tabular-nums">{history.data.movimientos.map((m) => (
              <li key={m.id} className="flex justify-between gap-3 border-t border-stone-100 pt-1"><span>{formatDate(m.fecha)} · {MOV_LABELS[m.tipo] ?? m.tipo}{m.motivo ? ` · ${m.motivo}` : ''}</span><span className="whitespace-nowrap">{m.cantidad > 0 ? '+' : ''}{formatInt(m.cantidad)} u.{m.costoUnitario !== null ? ` @ ${formatMoney(m.costoUnitario)}` : ''}</span></li>
            ))}</ul>
          </>
        ) : null}
      </Dialog>
    </div>
  );
}
