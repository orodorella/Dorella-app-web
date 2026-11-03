'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, Loader2, UserPlus } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { useToast } from '@/context/ToastProvider';
import { usePeriod } from '@/hooks/usePeriod';
import { formatDate, formatDateRange, formatInt, formatMoney, formatPct } from '@/lib/format';
import { KPI_DEFINITIONS } from '@/lib/kpi-definitions';
import PageHeader from '@/components/admin/PageHeader';
import PeriodSelector from '@/components/admin/PeriodSelector';
import HowCalculated from '@/components/admin/HowCalculated';
import InfoTip from '@/components/admin/InfoTip';
import Tabs, { tabPanelProps } from '@/components/admin/Tabs';
import Dialog from '@/components/admin/Dialog';
import { btnPrimary, btnSecondary, btnSm, btnTertiary, card, field, fieldLabel, sectionTitle, th } from '@/components/admin/styles';

const TIERS = ['detal', 'por_mayor', 'gran_mayor'] as const;
const TIER_LABELS: Record<string, string> = { detal: 'Detal', por_mayor: 'Por mayor', gran_mayor: 'Gran mayor' };
const STATUS_LABELS: Record<string, string> = { accrued: 'Causada', paid: 'Pagada', pending: 'Pendiente de pago' };
const TABS = [
  { id: 'liquidaciones', label: 'Liquidaciones' },
  { id: 'configuracion', label: 'Configuración' },
  { id: 'ajustes', label: 'Ajustes manuales' },
] as const;
type TabId = (typeof TABS)[number]['id'];

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
type Result = { success: boolean; error?: { message?: string } };

const RULES = [
  'Las comisiones se causan cuando el pago está aprobado, sobre el subtotal de mercancía después de descuentos y sin fletes.',
  'Cambiar un porcentaje solo aplica a pagos futuros; lo ya causado conserva el porcentaje de su fecha.',
  'Los ajustes manuales se aplican en la próxima liquidación del comercial.',
];
const validPct = (v: string) => v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100;

export default function ComisionesPage() {
  const { showToast } = useToast();
  const { period, setPeriod } = usePeriod();
  const { from, to } = period;
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: TabId = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'liquidaciones');
  const setTab = (id: TabId) => {
    const next = new URLSearchParams(params.toString());
    if (id === 'liquidaciones') next.delete('tab'); else next.set('tab', id);
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const [rules, setRules] = useState<{ current: Rule[]; history: Rule[] }>({ current: [], history: [] });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<SellerSummary[]>([]);
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adjust, setAdjust] = useState({ sellerId: '', monto: '', motivo: '' });
  const [limite, setLimite] = useState<string>('');
  const [limiteActual, setLimiteActual] = useState<string>('');
  const [confirmLiquidar, setConfirmLiquidar] = useState<SellerSummary | null>(null);
  const [confirmPagar, setConfirmPagar] = useState<Liquidation | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      request('GET', '/api/admin/finance/settings/discount-limit').then((x) => {
        if (x.success) { setLimite(String(x.data.maxDescuentoAdicional)); setLimiteActual(String(x.data.maxDescuentoAdicional)); }
      }).catch(() => undefined);
      const [r, s, l] = await Promise.all([
        request('GET', '/api/admin/commissions/rules'),
        request('GET', `/api/admin/commissions/summary?from=${from}&to=${to}`),
        request('GET', '/api/admin/commissions/liquidations'),
      ]);
      if (r.success) {
        setRules(r.data);
        const current = r.data.current as Rule[];
        setDrafts(Object.fromEntries(TIERS.map((t) => {
          const rule = current.find((x) => x.tier === t && x.userId === null);
          return [t, rule ? String(rule.porcentaje) : ''];
        })));
      }
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

  const generalRule = useCallback((tier: string) => rules.current.find((r) => r.tier === tier && r.userId === null), [rules]);
  const changedTiers = useMemo(
    () => TIERS.filter((t) => drafts[t] !== undefined && drafts[t] !== '' && Number(drafts[t]) !== generalRule(t)?.porcentaje),
    [drafts, generalRule],
  );
  const draftsValid = TIERS.every((t) => drafts[t] === '' || drafts[t] === undefined || validPct(drafts[t]));

  async function run(action: () => Promise<Result>, okMessage: string): Promise<boolean> {
    setBusy(true);
    try {
      const res = await action();
      if (!res.success) throw new Error(res.error?.message || 'No se pudo completar la acción');
      showToast(okMessage);
      await loadAll();
      return true;
    } catch (err) {
      showToast((err as Error).message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Un solo Guardar: envía (con el mismo endpoint de siempre) solo las modalidades que cambiaron. */
  async function savePercentages() {
    setBusy(true);
    const failed: string[] = [];
    for (const tier of changedTiers) {
      const res = await request('PUT', '/api/admin/commissions/rules', { tier, porcentaje: Number(drafts[tier]) }).catch((e: Error) => ({ success: false, error: { message: e.message } }));
      if (!res.success) failed.push(`${TIER_LABELS[tier]}: ${res.error?.message ?? 'error'}`);
    }
    setBusy(false);
    if (failed.length) showToast(`No se guardó ${failed.join(' · ')}`, 'error');
    else showToast(changedTiers.length === 1 ? 'Porcentaje actualizado' : 'Porcentajes actualizados');
    await loadAll();
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

  const noSellers = !loading && summary.length === 0;
  const pendingLiquidations = liquidations.filter((l) => l.status === 'pending').length;
  const noSellersNotice = (
    <div className={`${card} flex flex-col items-start gap-3 border-dashed p-6`}>
      <UserPlus size={22} className="text-wine" aria-hidden />
      <h3 className={sectionTitle}>Aún no hay usuarios con rol comercial</h3>
      <p className="text-sm text-stone-700">Las comisiones y los ajustes se registran por comercial. Asigna el rol comercial a tu equipo de ventas desde Usuarios.</p>
      <Link href="/admin/usuarios" className="text-sm font-semibold text-wine underline-offset-4 hover:underline">Ir a Usuarios</Link>
    </div>
  );

  return (
    <div>
      <PageHeader title="Comisiones" subtitle="Liquidación de comisiones por comercial y configuración de porcentajes." />
      <div className="mb-5"><HowCalculated rules={RULES} /></div>

      <Tabs
        label="Secciones de comisiones"
        tabs={TABS.map((t) => ({ ...t, badge: t.id === 'liquidaciones' && pendingLiquidations > 0 ? `${pendingLiquidations} por pagar` : undefined }))}
        active={tab}
        onChange={setTab}
      />

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-wine" aria-label="Cargando" /></div> : null}

      {!loading && tab === 'liquidaciones' ? (
        <div {...tabPanelProps('liquidaciones')} className="space-y-6 outline-none">
          <PeriodSelector period={period} onChange={setPeriod} />

          {noSellers ? noSellersNotice : (
            <section aria-label="Comisiones del periodo por comercial" className="space-y-4">
              {summary.map((s) => (
                <div key={s.sellerId} className={`${card} overflow-x-auto p-5`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-stone-900">{s.nombre}{s.isActive ? '' : ' (inactivo)'}</h3>
                    <button type="button" disabled={busy} className={`${btnPrimary} ${btnSm}`} onClick={() => setConfirmLiquidar(s)}>
                      Liquidar periodo
                    </button>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    {([
                      ['Estimada', s.estimada, KPI_DEFINITIONS.comisionEstimada],
                      ['Causada', s.causada, KPI_DEFINITIONS.comisionCausada],
                      ['Pagada', s.pagada, KPI_DEFINITIONS.comisionPagada],
                      ['Ajustes pendientes', s.ajustesPendientes, 'Ajustes manuales que entrarán en la próxima liquidación.'],
                    ] as const).map(([label, value, def]) => (
                      <div key={label} className="rounded-lg bg-ivory px-3 py-2">
                        <dt className="flex items-center gap-1 text-xs font-medium text-stone-600">{label}<InfoTip label={label} text={def} /></dt>
                        <dd className="mt-0.5 font-semibold tabular-nums text-stone-900">{formatMoney(value)}</dd>
                      </div>
                    ))}
                  </dl>
                  <table className="mt-4 w-full min-w-[560px] text-sm">
                    <thead className="border-b border-stone-100">
                      <tr><th className={`${th} !px-0 text-left`}>Modalidad</th><th className={`${th} text-right`}>Órdenes</th><th className={`${th} text-right`}>Base</th><th className={`${th} text-right`}>%</th><th className={`${th} text-right`}>Comisión</th><th className={`${th} !pr-0 text-right`}>Estado</th></tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {s.lines.length === 0 ? <tr><td colSpan={6} className="py-3 text-stone-600">Sin comisiones en el periodo.</td></tr> : s.lines.map((line) => (
                        <tr key={`${line.tier}-${line.porcentaje}-${line.status}`} className="border-t border-stone-100">
                          <td className="py-2">{TIER_LABELS[line.tier]}</td><td className="px-4 text-right">{formatInt(line.orders)}</td>
                          <td className="px-4 text-right">{formatMoney(line.base)}</td><td className="px-4 text-right">{formatPct(line.porcentaje, { digits: 2 })}</td>
                          <td className="px-4 text-right font-medium">{formatMoney(line.monto)}</td><td className="text-right">{STATUS_LABELS[line.status] ?? line.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>
          )}

          <section className={`${card} overflow-x-auto`}>
            <h2 className={`${sectionTitle} p-5 pb-3`}>Liquidaciones registradas</h2>
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className={`${th} text-left`}>Comercial</th><th className={`${th} text-left`}>Periodo</th><th className={`${th} text-right`}>Comisión</th>
                  <th className={`${th} text-right`}>Ajustes</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-left`}>Estado</th><th className={`${th} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 tabular-nums">
                {liquidations.length === 0 ? <tr><td colSpan={7} className="px-4 py-6 text-center text-stone-600">Aún no hay liquidaciones.</td></tr> : liquidations.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 font-medium text-stone-900">{l.sellerName}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDateRange(l.periodFrom, l.periodTo)}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(l.subtotal)}</td><td className="px-4 py-3 text-right">{formatMoney(l.ajustes)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-wine">{formatMoney(l.total)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{STATUS_LABELS[l.status] ?? l.status}{l.paidAt ? ` · ${formatDate(l.paidAt)}` : ''}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" className={btnTertiary} onClick={() => download(l.id)}><Download size={14} aria-hidden /> CSV</button>
                        {l.status === 'pending' ? (
                          <button type="button" disabled={busy} className={`${btnSecondary} ${btnSm}`} onClick={() => setConfirmPagar(l)}>Marcar pagada</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}

      {!loading && tab === 'configuracion' ? (
        <div {...tabPanelProps('configuracion')} className="space-y-6 outline-none">
          <form
            className={`${card} p-5`}
            onSubmit={(e) => { e.preventDefault(); if (changedTiers.length && draftsValid) void savePercentages(); }}
          >
            <h2 className={`${sectionTitle} mb-1`}>Porcentaje por modalidad</h2>
            <p className="mb-4 text-sm text-stone-600">Aplica a pagos aprobados desde que guardas; lo ya causado conserva su porcentaje.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {TIERS.map((tier) => {
                const current = generalRule(tier);
                const invalid = drafts[tier] !== '' && drafts[tier] !== undefined && !validPct(drafts[tier]);
                return (
                  <label key={tier} className="rounded-xl border border-stone-200 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">{TIER_LABELS[tier]}</span>
                    <span className="mt-2 flex items-center gap-2">
                      <input
                        type="number" min={0} max={100} step="0.01" inputMode="decimal" placeholder="Sin definir"
                        value={drafts[tier] ?? ''} onChange={(e) => setDrafts({ ...drafts, [tier]: e.target.value })}
                        aria-invalid={invalid}
                        className={`${field} w-32 tabular-nums ${invalid ? '!border-red-500' : ''}`}
                      />
                      <span className="text-sm text-stone-700">%</span>
                    </span>
                    <span className="mt-2 block text-xs text-stone-600">
                      Vigente: {current ? `${formatPct(current.porcentaje, { digits: 2 })} desde ${formatDate(current.validFrom)}` : 'sin definir (0 %)'}
                    </span>
                    {invalid ? <span className="mt-1 block text-xs text-red-700">Debe estar entre 0 y 100.</span> : null}
                  </label>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={busy || changedTiers.length === 0 || !draftsValid} className={btnPrimary}>
                {busy ? 'Guardando…' : 'Guardar porcentajes'}
              </button>
              <span className="text-sm text-stone-600">
                {changedTiers.length === 0 ? 'Sin cambios.' : `Cambios en: ${changedTiers.map((t) => TIER_LABELS[t]).join(', ')}.`}
              </span>
            </div>
            {rules.current.some((r) => r.userId) ? (
              <p className="mt-4 text-sm text-stone-700">
                Reglas específicas por comercial: {rules.current.filter((r) => r.userId).map((r) => `${r.sellerName} · ${TIER_LABELS[r.tier]} ${formatPct(r.porcentaje, { digits: 2 })}`).join(' | ')}
              </p>
            ) : null}
            {rules.history.length ? (
              <details className="mt-4 text-sm text-stone-700">
                <summary className="cursor-pointer font-medium">Historial de porcentajes ({formatInt(rules.history.length)})</summary>
                <ul className="mt-2 space-y-1">
                  {rules.history.map((r) => (
                    <li key={r.id}>{TIER_LABELS[r.tier]}{r.sellerName ? ` · ${r.sellerName}` : ''}: {formatPct(r.porcentaje, { digits: 2 })} — {formatDate(r.validFrom)} a {formatDate(r.validTo)}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </form>

          <form
            className={`${card} p-5`}
            onSubmit={(e) => { e.preventDefault(); void run(() => request('PUT', '/api/admin/finance/settings/discount-limit', { maxDescuentoAdicional: Number(limite) }), 'Límite de descuento actualizado'); }}
          >
            <h2 className={`${sectionTitle} mb-1`}>Descuento extra máximo del comercial</h2>
            <p className="mb-3 text-sm text-stone-600">Tope por línea que un comercial puede aplicar al crear un pedido, además del descuento de nivel. El administrador no tiene tope.</p>
            <div className="flex flex-wrap items-center gap-2">
              <input type="number" min={0} max={100} step="0.5" aria-label="Descuento extra máximo (%)" value={limite} onChange={(e) => setLimite(e.target.value)} className={`${field} w-28 tabular-nums`} />
              <span className="text-sm text-stone-700">%</span>
              <button type="submit" disabled={busy || !validPct(limite) || limite === limiteActual} className={btnPrimary}>Guardar límite</button>
            </div>
          </form>
        </div>
      ) : null}

      {!loading && tab === 'ajustes' ? (
        <div {...tabPanelProps('ajustes')} className="space-y-6 outline-none">
          {noSellers ? noSellersNotice : null}
          <form
            className={`${card} p-5`}
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(
                () => request('POST', '/api/admin/commissions/adjustments', { sellerId: adjust.sellerId, monto: Number(adjust.monto), motivo: adjust.motivo }),
                'Ajuste registrado (se aplica en la próxima liquidación)',
              );
              if (ok) setAdjust({ sellerId: '', monto: '', motivo: '' });
            }}
          >
            <h2 className={`${sectionTitle} mb-1`}>Registrar ajuste manual</h2>
            <p className="mb-4 text-sm text-stone-600">
              {noSellers
                ? 'Disponible cuando exista al menos un usuario con rol comercial.'
                : 'Suma o resta un monto a la próxima liquidación del comercial (usa un valor negativo para descontar).'}
            </p>
            <fieldset disabled={noSellers || busy} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,2fr)_auto] sm:items-end">
              <label className={fieldLabel}>Comercial
                <select value={adjust.sellerId} onChange={(e) => setAdjust({ ...adjust, sellerId: e.target.value })} className={`${field} mt-1 w-full`}>
                  <option value="">Selecciona…</option>
                  {summary.map((s) => <option key={s.sellerId} value={s.sellerId}>{s.nombre}</option>)}
                </select>
              </label>
              <label className={fieldLabel}>Monto (COP, +/−)
                <input type="number" step="0.01" placeholder="-50000" value={adjust.monto} onChange={(e) => setAdjust({ ...adjust, monto: e.target.value })} className={`${field} mt-1 w-full tabular-nums`} />
              </label>
              <label className={fieldLabel}>Motivo
                <input type="text" placeholder="Ej. devolución de la orden DOR-…" value={adjust.motivo} onChange={(e) => setAdjust({ ...adjust, motivo: e.target.value })} className={`${field} mt-1 w-full`} />
              </label>
              <button type="submit" disabled={noSellers || busy || !adjust.sellerId || !adjust.monto || !adjust.motivo} className={btnPrimary}>Registrar ajuste</button>
            </fieldset>
          </form>
        </div>
      ) : null}

      <Dialog
        open={!!confirmLiquidar}
        title="Liquidar comisiones del periodo"
        onClose={() => setConfirmLiquidar(null)}
        size="sm"
        footer={(
          <>
            <button type="button" className={btnSecondary} onClick={() => setConfirmLiquidar(null)}>Cancelar</button>
            <button
              type="button" disabled={busy} className={btnPrimary}
              onClick={async () => {
                const s = confirmLiquidar;
                if (!s) return;
                const ok = await run(() => request('POST', '/api/admin/commissions/liquidations', { sellerId: s.sellerId, from, to }), 'Liquidación creada');
                if (ok) setConfirmLiquidar(null);
              }}
            >
              Crear liquidación
            </button>
          </>
        )}
      >
        {confirmLiquidar ? (
          <div className="space-y-3">
            <p>Se creará una liquidación <strong>pendiente de pago</strong> para <strong>{confirmLiquidar.nombre}</strong> con las comisiones causadas entre <strong>{period.rangeLabel}</strong> y sus ajustes pendientes.</p>
            <ul className="space-y-1 rounded-lg bg-ivory p-3 tabular-nums">
              <li className="flex justify-between"><span>Comisiones causadas</span><span>{formatMoney(confirmLiquidar.causada)}</span></li>
              <li className="flex justify-between"><span>Ajustes pendientes</span><span>{formatMoney(confirmLiquidar.ajustesPendientes)}</span></li>
            </ul>
            <p className="text-stone-600">El total definitivo lo calcula el sistema al crearla. Las comisiones estimadas (pago pendiente) no entran.</p>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={!!confirmPagar}
        title="Marcar liquidación como pagada"
        onClose={() => setConfirmPagar(null)}
        size="sm"
        footer={(
          <>
            <button type="button" className={btnSecondary} onClick={() => setConfirmPagar(null)}>Cancelar</button>
            <button
              type="button" disabled={busy} className={btnPrimary}
              onClick={async () => {
                const l = confirmPagar;
                if (!l) return;
                const ok = await run(() => request('POST', `/api/admin/commissions/liquidations/${l.id}/pay`), 'Liquidación marcada como pagada');
                if (ok) setConfirmPagar(null);
              }}
            >
              Marcar pagada
            </button>
          </>
        )}
      >
        {confirmPagar ? (
          <p>Confirma que pagaste <strong>{formatMoney(confirmPagar.total)}</strong> a <strong>{confirmPagar.sellerName}</strong> por {formatDateRange(confirmPagar.periodFrom, confirmPagar.periodTo)}. Esta acción queda registrada.</p>
        ) : null}
      </Dialog>
    </div>
  );
}
