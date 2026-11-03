'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { useToast } from '@/context/ToastProvider';

const TIERS = ['detal', 'por_mayor', 'gran_mayor'] as const;
const TIER_LABELS: Record<string, string> = { detal: 'Detal', por_mayor: 'Por mayor', gran_mayor: 'Gran mayor' };
const STATUS_LABELS: Record<string, string> = { accrued: 'Causada', paid: 'Pagada', pending: 'Pendiente' };

interface Rule { id: string; tier: string; userId: string | null; sellerName: string | null; porcentaje: number; validFrom: string; validTo: string | null }
interface SummaryLine { tier: string; porcentaje: number; orders: number; base: number; monto: number; status: string }
interface SellerSummary {
  sellerId: string; nombre: string; isActive: boolean; lines: SummaryLine[];
  estimada: number; causada: number; pagada: number; ajustesPendientes: number;
}
interface Liquidation {
  id: string; sellerId: string; sellerName: string; periodFrom: string; periodTo: string;
  subtotal: number; ajustes: number; total: number; status: string; entries: number; paidAt: string | null;
}

// Fecha de hoy en hora de Colombia (UTC-5), no en UTC.
const isoDay = (d: Date) => new Date(d.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
const field = 'rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700';
const btn = 'cursor-pointer rounded-lg bg-wine px-4 py-2 text-xs font-semibold text-white hover:bg-wine-light disabled:opacity-50';

export default function ComisionesPage() {
  const { showToast } = useToast();
  const today = new Date();
  const [from, setFrom] = useState(`${isoDay(today).slice(0, 8)}01`);
  const [to, setTo] = useState(isoDay(today));
  const [rules, setRules] = useState<{ current: Rule[]; history: Rule[] }>({ current: [], history: [] });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<SellerSummary[]>([]);
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adjust, setAdjust] = useState({ sellerId: '', monto: '', motivo: '' });
  const [limite, setLimite] = useState<string>('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      request('GET', '/api/admin/finance/settings/discount-limit').then((x) => { if (x.success) setLimite(String(x.data.maxDescuentoAdicional)); }).catch(() => undefined);
      const [r, s, l] = await Promise.all([
        request('GET', '/api/admin/commissions/rules'),
        request('GET', `/api/admin/commissions/summary?from=${from}&to=${to}`),
        request('GET', '/api/admin/commissions/liquidations'),
      ]);
      if (r.success) setRules(r.data);
      if (s.success) setSummary(s.data.sellers);
      if (l.success) setLiquidations(l.data);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [from, to, showToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const generalRule = (tier: string) => rules.current.find((r) => r.tier === tier && r.userId === null);

  async function run(action: () => Promise<{ success: boolean; error?: { message?: string } }>, okMessage: string) {
    setBusy(true);
    try {
      const res = await action();
      if (!res.success) throw new Error(res.error?.message || 'No se pudo completar la acción');
      showToast(okMessage);
      await loadAll();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function download(id: string) {
    const res = await fetch(`/api/admin/commissions/liquidations/${id}/export`, { credentials: 'include' });
    if (!res.ok) {
      showToast('No se pudo exportar la liquidación', 'error');
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `liquidacion-${id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1 className="mb-1 text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Comisiones</h1>
      <p className="mb-6 text-sm text-stone-400">
        Se causan cuando el pago está aprobado, sobre el subtotal de mercancía después de descuentos y sin fletes.
        Cambiar un porcentaje solo aplica a pagos futuros; lo ya causado conserva el porcentaje de su fecha.
      </p>

      <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-stone-700">Descuento extra máximo del comercial</h2>
        <p className="mb-3 text-xs text-stone-400">Tope por línea que un comercial puede aplicar al crear un pedido (además del descuento de nivel). El administrador no tiene tope.</p>
        <div className="flex items-center gap-2">
          <input type="number" min={0} max={100} step="0.5" aria-label="Descuento extra máximo (%)" value={limite} onChange={(e) => setLimite(e.target.value)} className={`${field} w-28`} />
          <span className="text-sm text-stone-500">%</span>
          <button
            disabled={busy || limite === ''} className={btn}
            onClick={() => run(() => request('PUT', '/api/admin/finance/settings/discount-limit', { maxDescuentoAdicional: Number(limite) }), 'Límite de descuento actualizado')}
          >
            Guardar
          </button>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-stone-700">Porcentaje por modalidad</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {TIERS.map((tier) => {
            const current = generalRule(tier);
            return (
              <div key={tier} className="rounded-xl border border-stone-100 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{TIER_LABELS[tier]}</p>
                <p className="mt-1 text-2xl text-wine">{current ? `${current.porcentaje}%` : 'Sin definir (0%)'}</p>
                <div className="mt-3 flex gap-2">
                  <input
                    type="number" min={0} max={100} step="0.01" placeholder="Nuevo %"
                    value={drafts[tier] ?? ''} onChange={(e) => setDrafts({ ...drafts, [tier]: e.target.value })}
                    className={`${field} w-28`}
                  />
                  <button
                    disabled={busy || drafts[tier] === undefined || drafts[tier] === ''} className={btn}
                    onClick={() => run(
                      () => request('PUT', '/api/admin/commissions/rules', { tier, porcentaje: Number(drafts[tier]) }),
                      'Porcentaje actualizado',
                    ).then(() => setDrafts({ ...drafts, [tier]: '' }))}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {rules.current.some((r) => r.userId) ? (
          <p className="mt-3 text-xs text-stone-500">
            Reglas específicas por comercial: {rules.current.filter((r) => r.userId).map((r) => `${r.sellerName} · ${TIER_LABELS[r.tier]} ${r.porcentaje}%`).join(' | ')}
          </p>
        ) : null}
        {rules.history.length ? (
          <details className="mt-3 text-xs text-stone-500">
            <summary className="cursor-pointer">Historial de porcentajes ({rules.history.length})</summary>
            <ul className="mt-2 space-y-1">
              {rules.history.map((r) => (
                <li key={r.id}>{TIER_LABELS[r.tier]}{r.sellerName ? ` · ${r.sellerName}` : ''}: {r.porcentaje}% — {r.validFrom.slice(0, 10)} a {r.validTo?.slice(0, 10)}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-stone-500">Desde<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={`${field} mt-1 block`} /></label>
        <label className="text-xs text-stone-500">Hasta<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={`${field} mt-1 block`} /></label>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-wine" /></div> : (
        <>
          <section className="mb-6 space-y-4">
            {summary.length === 0 ? <p className="text-sm text-stone-400">No hay usuarios con rol comercial.</p> : summary.map((s) => (
              <div key={s.sellerId} className="overflow-x-auto rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-stone-800">{s.nombre}{s.isActive ? '' : ' (inactivo)'}</h3>
                  <button
                    disabled={busy} className={btn}
                    onClick={() => run(
                      () => request('POST', '/api/admin/commissions/liquidations', { sellerId: s.sellerId, from, to }),
                      'Liquidación creada',
                    )}
                  >
                    Liquidar periodo
                  </button>
                </div>
                <table className="mt-3 w-full min-w-[560px] text-sm">
                  <thead className="text-[10px] uppercase tracking-wider text-stone-400">
                    <tr><th className="py-1 text-left">Modalidad</th><th className="text-right">Órdenes</th><th className="text-right">Base</th><th className="text-right">%</th><th className="text-right">Comisión</th><th className="text-right">Estado</th></tr>
                  </thead>
                  <tbody>
                    {s.lines.length === 0 ? <tr><td colSpan={6} className="py-3 text-stone-400">Sin comisiones causadas en el periodo.</td></tr> : s.lines.map((line) => (
                      <tr key={`${line.tier}-${line.porcentaje}-${line.status}`} className="border-t border-stone-100">
                        <td className="py-2">{TIER_LABELS[line.tier]}</td><td className="text-right">{line.orders}</td>
                        <td className="text-right">{formatCOP(line.base)}</td><td className="text-right">{line.porcentaje}%</td>
                        <td className="text-right font-medium">{formatCOP(line.monto)}</td><td className="text-right">{STATUS_LABELS[line.status] ?? line.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-stone-500">
                  Estimada (pago pendiente): {formatCOP(s.estimada)} · Causada: {formatCOP(s.causada)} · Pagada: {formatCOP(s.pagada)} · Ajustes pendientes: {formatCOP(s.ajustesPendientes)}
                </p>
              </div>
            ))}
          </section>

          <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-stone-700">Ajuste manual</h2>
            <div className="flex flex-wrap items-end gap-3">
              <select value={adjust.sellerId} onChange={(e) => setAdjust({ ...adjust, sellerId: e.target.value })} className={field}>
                <option value="">Comercial…</option>
                {summary.map((s) => <option key={s.sellerId} value={s.sellerId}>{s.nombre}</option>)}
              </select>
              <input type="number" step="0.01" placeholder="Monto (+/-)" value={adjust.monto} onChange={(e) => setAdjust({ ...adjust, monto: e.target.value })} className={`${field} w-36`} />
              <input type="text" placeholder="Motivo" value={adjust.motivo} onChange={(e) => setAdjust({ ...adjust, motivo: e.target.value })} className={`${field} min-w-[220px] flex-1`} />
              <button
                disabled={busy || !adjust.sellerId || !adjust.monto || !adjust.motivo} className={btn}
                onClick={() => run(
                  () => request('POST', '/api/admin/commissions/adjustments', { sellerId: adjust.sellerId, monto: Number(adjust.monto), motivo: adjust.motivo }),
                  'Ajuste registrado (se aplica en la próxima liquidación)',
                ).then(() => setAdjust({ sellerId: '', monto: '', motivo: '' }))}
              >
                Registrar
              </button>
            </div>
          </section>

          <section className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
            <h2 className="p-5 pb-2 text-sm font-semibold text-stone-700">Liquidaciones</h2>
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400">
                <tr><th className="px-4 py-2 text-left">Comercial</th><th className="text-left">Periodo</th><th className="text-right">Comisión</th><th className="text-right">Ajustes</th><th className="text-right">Total</th><th className="text-right">Estado</th><th className="px-4 text-right">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {liquidations.length === 0 ? <tr><td colSpan={7} className="px-4 py-6 text-center text-stone-400">Aún no hay liquidaciones.</td></tr> : liquidations.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 font-medium">{l.sellerName}</td><td>{l.periodFrom} a {l.periodTo}</td>
                    <td className="text-right">{formatCOP(l.subtotal)}</td><td className="text-right">{formatCOP(l.ajustes)}</td>
                    <td className="text-right font-semibold text-wine">{formatCOP(l.total)}</td>
                    <td className="text-right">{STATUS_LABELS[l.status]}{l.paidAt ? ` · ${l.paidAt.slice(0, 10)}` : ''}</td>
                    <td className="space-x-2 px-4 py-2 text-right">
                      <button className="cursor-pointer text-xs text-wine underline" onClick={() => download(l.id)}>CSV</button>
                      {l.status === 'pending' ? (
                        <button
                          disabled={busy} className="cursor-pointer text-xs text-emerald-700 underline"
                          onClick={() => run(() => request('POST', `/api/admin/commissions/liquidations/${l.id}/pay`), 'Liquidación marcada como pagada')}
                        >
                          Marcar pagada
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
