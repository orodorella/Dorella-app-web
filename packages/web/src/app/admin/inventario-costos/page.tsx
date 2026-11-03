'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { useToast } from '@/context/ToastProvider';
import { usePeriod } from '@/hooks/usePeriod';
import { formatDate, formatInt } from '@/lib/format';
import { KPI_DEFINITIONS } from '@/lib/kpi-definitions';
import PageHeader from '@/components/admin/PageHeader';
import PeriodSelector from '@/components/admin/PeriodSelector';
import HowCalculated from '@/components/admin/HowCalculated';
import KpiCard from '@/components/admin/KpiCard';

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

const isoDay = (d: Date) => new Date(d.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
const field = 'rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700';
const btn = 'cursor-pointer rounded-lg bg-wine px-4 py-2 text-xs font-semibold text-white hover:bg-wine-light disabled:opacity-50';
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const emptyForm = { tipo: 'compra', cantidad: '', costoUnitario: '', gastosAdicionales: '', proveedor: '', fechaCompra: isoDay(new Date()), referencia: '', observaciones: '' };
const RULES = [
  'Cada compra conserva su costo; las ventas consumen los lotes más antiguos primero (FIFO).',
  'Una compra suma el stock una sola vez: no vuelvas a sumar esas unidades por otra vía.',
  'Los gastos adicionales de una compra (flete…) se reparten entre sus unidades y forman parte de su costo; no los registres también como gasto operativo.',
  'El periodo solo afecta «Compras del periodo»; el inventario valorizado es a hoy.',
];
const MOV_LABELS: Record<string, string> = { compra: 'Compra', valoracion_inicial: 'Valoración inicial', venta: 'Venta', devolucion: 'Devolución', ajuste: 'Ajuste' };

export default function InventarioCostosPage() {
  const { showToast } = useToast();
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
      setForm(emptyForm);
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
  return (
    <div>
      <PageHeader title="Compras e inventario valorizado" subtitle="Registra compras, valora existencias y consulta el costo del inventario.">
        <PeriodSelector period={period} onChange={setPeriod} />
      </PageHeader>
      <div className="mb-6"><HowCalculated rules={RULES} /></div>

      <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-stone-700">Registrar compra o valorar existencias</h2>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            {product ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm">
                <span>{product.nombre} <span className="text-stone-400">({product.sku})</span></span>
                <button type="button" className="cursor-pointer text-xs underline" onClick={() => { setProduct(null); setSearch(''); }}>Cambiar</button>
              </div>
            ) : (
              <>
                <input aria-label="Producto" placeholder="Buscar producto por nombre o SKU" value={search} onChange={(e) => setSearch(e.target.value)} className={`${field} w-full`} />
                {options.length > 0 ? (
                  <ul className="absolute z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
                    {options.map((o) => (
                      <li key={o.id}><button type="button" className="w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-champagne/40" onClick={() => { setProduct(o); setOptions([]); }}>{o.nombre} <span className="text-stone-400">({o.sku})</span></button></li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
          <select aria-label="Tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={field}>
            <option value="compra">Compra (suma stock)</option>
            <option value="valoracion_inicial">Valoración inicial (no suma stock)</option>
          </select>
          <input aria-label="Fecha de compra" type="date" value={form.fechaCompra} max={isoDay(new Date())} onChange={(e) => setForm({ ...form, fechaCompra: e.target.value })} className={field} />
          <input aria-label="Cantidad" type="number" min={1} step={1} required placeholder="Cantidad" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} className={field} />
          <input aria-label="Costo unitario" type="number" min={0} step="0.01" required placeholder="Costo unitario COP" value={form.costoUnitario} onChange={(e) => setForm({ ...form, costoUnitario: e.target.value })} className={field} />
          <input aria-label="Gastos adicionales" type="number" min={0} step="0.01" placeholder="Gastos adicionales de la compra (flete…)" value={form.gastosAdicionales} onChange={(e) => setForm({ ...form, gastosAdicionales: e.target.value })} className={field} />
          <input aria-label="Proveedor" placeholder="Proveedor" value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} className={field} />
          <input aria-label="Referencia o factura" placeholder="Referencia o factura (opcional)" value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} className={field} />
          <input aria-label="Observaciones" placeholder="Observaciones" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} className={`${field} sm:col-span-2`} />
          <button type="submit" disabled={busy || !product || !form.cantidad || form.costoUnitario === ''} className={btn}>{busy ? 'Guardando…' : 'Registrar'}</button>
        </form>
        <p className="mt-2 text-[11px] text-stone-400">Los gastos adicionales se reparten entre las unidades de esta compra y forman parte de su costo; no los registres también como gasto operativo.</p>
      </section>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-wine" /></div> : valuation && r ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Compras del periodo" value={formatCOP(r.comprasPeriodo)} definition={KPI_DEFINITIONS.comprasPeriodo} hint={`${formatInt(r.unidadesCompradasPeriodo)} unidades`} />
            <KpiCard label="Inventario valorizado" value={formatCOP(r.inventarioValorizado)} definition={KPI_DEFINITIONS.inventarioValorizado} hint={`${formatInt(r.unidadesValoradas)} unidades valoradas`} />
            <KpiCard label="Costo promedio unitario" value={formatCOP(r.costoPromedioUnitario)} definition={KPI_DEFINITIONS.costoPromedio} />
            <KpiCard label="Unidades sin valorar" value={formatInt(r.unidadesSinValorar)} definition={KPI_DEFINITIONS.unidadesSinValorar} tone={r.unidadesSinValorar > 0 ? 'gold' : 'default'} />
          </div>
          {r.productosConValoracionMayorAlStock > 0 ? (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{r.productosConValoracionMayorAlStock} producto(s) tienen más unidades valoradas que stock físico: revisa ajustes de stock o lotes.</p>
          ) : null}

          <section className="mt-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400">
                <tr><th className="px-4 py-2 text-left">Producto</th><th className="text-right">Stock</th><th className="text-right">Valoradas</th><th className="text-right">Sin valorar</th><th className="text-right">Costo prom.</th><th className="text-right">Valorizado</th><th className="px-4" /></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {valuation.productos.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2"><p className="font-medium text-stone-700">{p.nombre}</p><p className="text-xs text-stone-400">{p.sku} · {p.lotesActivos} lote(s)</p></td>
                    <td className="text-right">{p.stock}</td><td className="text-right">{p.unidadesValoradas}{p.valoracionExcedeStock ? ' ⚠' : ''}</td>
                    <td className={`text-right ${p.unidadesSinValorar > 0 ? 'text-amber-700' : ''}`}>{p.unidadesSinValorar}</td>
                    <td className="text-right">{p.costoPromedio === null ? '—' : formatCOP(p.costoPromedio)}</td>
                    <td className="text-right font-semibold text-wine">{formatCOP(p.valorizado)}</td>
                    <td className="px-4 text-right"><button className="cursor-pointer text-xs text-wine underline" onClick={() => openHistory(p)}>Historial</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-xs text-stone-500">{valuation.notas.map((n) => <li key={n}>{n}</li>)}</ul>
        </>
      ) : null}

      {history ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setHistory(null)}>
          <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Historial de costos">
            <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-stone-800">Historial · {history.producto}</h3><button className="cursor-pointer text-sm text-stone-500" onClick={() => setHistory(null)}>Cerrar</button></div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-stone-400">Lotes</h4>
            <table className="mb-4 w-full text-xs">
              <thead className="text-stone-400"><tr><th className="text-left">Fecha</th><th className="text-left">Proveedor / ref.</th><th className="text-right">Compra</th><th className="text-right">Restante</th><th className="text-right">Costo efectivo</th></tr></thead>
              <tbody>{history.data.lotes.map((l) => (
                <tr key={l.id} className="border-t border-stone-100"><td>{formatDate(l.fechaCompra)}{l.tipo === 'valoracion_inicial' ? ' (inicial)' : ''}</td><td>{[l.proveedor, l.referencia].filter(Boolean).join(' · ') || '—'}</td><td className="text-right">{l.cantidad}</td><td className="text-right">{l.cantidadRestante}</td><td className="text-right">{formatCOP(l.costoEfectivo)}</td></tr>
              ))}</tbody>
            </table>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-stone-400">Movimientos</h4>
            <ul className="space-y-1 text-xs">{history.data.movimientos.map((m) => (
              <li key={m.id} className="flex justify-between border-t border-stone-100 pt-1"><span>{formatDate(m.fecha)} · {MOV_LABELS[m.tipo] ?? m.tipo}{m.motivo ? ` · ${m.motivo}` : ''}</span><span>{m.cantidad > 0 ? '+' : ''}{m.cantidad} u.{m.costoUnitario !== null ? ` @ ${formatCOP(m.costoUnitario)}` : ''}</span></li>
            ))}</ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
