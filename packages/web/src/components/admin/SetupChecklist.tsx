'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { formatInt, formatMoney } from '@/lib/format';
import ProgressBar from '@/components/admin/ProgressBar';
import { card } from '@/components/admin/styles';

const TIERS = ['detal', 'por_mayor', 'gran_mayor'] as const;

interface Status {
  productos: number;
  sinCosto: number;
  unidadesSinValorar: number | null;
  tiersConComision: number;
}

interface Props {
  /** Si la pantalla ya lo tiene (p. ej. el resumen financiero), no se vuelve a pedir. */
  unidadesSinValorar?: number;
  /** Rango para pedir la valoración cuando no viene dado. */
  from: string;
  to: string;
  /** Ingresos cobrados del periodo que no tienen costo. */
  pendienteCosteo?: number;
}

/**
 * Lista de configuración de las pantallas financieras: sin costos, inventario valorado y
 * porcentajes de comisión, la utilidad no se puede calcular. Solo lee (no cambia nada).
 * Se oculta cuando todo está completo.
 */
export default function SetupChecklist({ unidadesSinValorar, from, to, pendienteCosteo = 0 }: Props) {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [all, missing, rules, valuation] = await Promise.all([
        request('GET', '/api/admin/finance/costs/products?pageSize=1'),
        request('GET', '/api/admin/finance/costs/products?pageSize=1&sinCosto=true'),
        request('GET', '/api/admin/commissions/rules'),
        unidadesSinValorar === undefined ? request('GET', `/api/admin/finance/inventory/valuation?from=${from}&to=${to}`) : Promise.resolve(null),
      ].map((p) => p.catch(() => null)));
      if (cancelled || !all?.success || !missing?.success) return;
      const current = (rules?.success ? rules.data.current : []) as Array<{ tier: string; userId: string | null }>;
      setStatus({
        productos: Number(all.meta?.total ?? 0),
        sinCosto: Number(missing.meta?.total ?? 0),
        unidadesSinValorar: unidadesSinValorar ?? (valuation?.success ? Number(valuation.data.resumen.unidadesSinValorar) : null),
        tiersConComision: TIERS.filter((t) => current.some((r) => r.tier === t && r.userId === null)).length,
      });
    })();
    return () => { cancelled = true; };
  }, [unidadesSinValorar, from, to]);

  if (!status) return null;
  const conCosto = status.productos - status.sinCosto;
  const steps = [
    {
      done: status.sinCosto === 0,
      title: 'Costos de productos',
      body: <ProgressBar value={conCosto} total={status.productos} label="Productos activos con costo" />,
      extra: pendienteCosteo > 0 ? `${formatMoney(pendienteCosteo)} de ingresos cobrados del periodo aún no tienen costo.` : null,
      href: '/admin/costos?sinCosto=1',
      cta: 'Cargar costos',
    },
    {
      done: status.unidadesSinValorar === 0,
      title: 'Inventario valorado',
      body: status.unidadesSinValorar === null ? 'No se pudo consultar.' : `${formatInt(status.unidadesSinValorar)} unidades en stock sin valorar (sin costo de compra).`,
      extra: null,
      href: '/admin/inventario-costos?sinValorar=1',
      cta: 'Valorar existencias',
    },
    {
      done: status.tiersConComision === TIERS.length,
      title: 'Porcentajes de comisión',
      body: `${status.tiersConComision} de ${TIERS.length} modalidades con porcentaje definido.`,
      extra: null,
      href: '/admin/comisiones?tab=configuracion',
      cta: 'Definir porcentajes',
    },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    <section aria-labelledby="setup-title" className={`${card} mb-6 border-gold/50 p-5`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="setup-title" className="text-base font-semibold text-stone-900">Completa la configuración para ver la utilidad real</h2>
        <span className="text-sm text-stone-600">{done} de {steps.length} pasos listos</span>
      </div>
      <ol className="grid gap-4 lg:grid-cols-3">
        {steps.map((s) => (
          <li key={s.title} className={`flex flex-col gap-2 rounded-xl border p-4 ${s.done ? 'border-emerald-200 bg-emerald-50/40' : 'border-stone-200 bg-ivory'}`}>
            <p className="flex items-center gap-2 font-medium text-stone-900">
              {s.done ? <CheckCircle2 size={18} className="text-emerald-700" aria-label="Listo" /> : <Circle size={18} className="text-stone-400" aria-label="Pendiente" />}
              {s.title}
            </p>
            <div className="text-sm text-stone-700">{s.body}</div>
            {s.extra ? <p className="text-xs text-amber-900">{s.extra}</p> : null}
            {!s.done ? (
              <Link href={s.href} className="mt-auto inline-flex items-center gap-1 self-start text-sm font-semibold text-wine underline-offset-4 hover:underline">
                {s.cta} <ArrowRight size={14} aria-hidden />
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
