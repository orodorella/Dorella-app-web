import Link from 'next/link';
import { AlertTriangle, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import InfoTip from '@/components/admin/InfoTip';
import { formatPct } from '@/lib/format';

export interface KpiDelta {
  /** Variación en puntos porcentuales (22.1 = +22,1 %); null si no hay base de comparación. */
  pct: number | null;
  /** "vs. los 30 días anteriores", "vs. mismo tramo del mes anterior"… */
  label: string;
  /** Rango comparado, para el atributo title. */
  detail?: string;
}

interface Props {
  label: string;
  value: React.ReactNode;
  /** Qué cuenta la cifra; se muestra en el tooltip. */
  definition?: string;
  hint?: React.ReactNode;
  delta?: KpiDelta;
  tone?: 'default' | 'wine' | 'gold';
  /** Si la cifra no se puede calcular todavía (p. ej. faltan costos), se muestra este texto en vez de $0. */
  missing?: string | null;
  missingHref?: string;
  href?: string;
  loading?: boolean;
}

const TONES = { default: 'border-stone-200', wine: 'border-wine/30', gold: 'border-gold/50' };

export function DeltaText({ delta }: { delta: KpiDelta }) {
  if (delta.pct === null) {
    if (!delta.label) return <span className="text-stone-500" title="Sin base de comparación">—</span>;
    return <span className="text-xs text-stone-500" title={delta.detail}>Sin base de comparación {delta.label.replace(/^vs\.\s*/, 'con ')}</span>;
  }
  const up = delta.pct > 0;
  const down = delta.pct < 0;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 text-xs" title={delta.detail}>
      <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${up ? 'bg-emerald-50 text-emerald-700' : down ? 'bg-red-50 text-red-700' : 'bg-stone-100 text-stone-600'}`}>
        {up ? <ArrowUpRight size={12} aria-hidden /> : down ? <ArrowDownRight size={12} aria-hidden /> : null}
        {formatPct(delta.pct, { signed: true })}
      </span>
      <span className="text-stone-600">{delta.label}</span>
    </span>
  );
}

/** Tarjeta de indicador con definición visible (tooltip), comparación y estado "falta dato". */
export default function KpiCard({ label, value, definition, hint, delta, tone = 'default', missing, missingHref, href, loading }: Props) {
  const body = (
    <>
      <div className="flex items-center gap-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">{label}</p>
        {definition ? <InfoTip label={label} text={definition} /> : null}
      </div>
      {loading ? (
        <div aria-hidden className="mt-2 h-8 w-32 animate-pulse rounded bg-stone-100" />
      ) : missing ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-lg font-semibold text-amber-800">
          <AlertTriangle size={18} aria-hidden />
          {missingHref ? <Link href={missingHref} className="underline-offset-4 hover:underline">{missing}</Link> : missing}
        </p>
      ) : (
        <p className={`mt-2 text-2xl font-semibold tabular-nums ${tone === 'wine' ? 'text-wine' : 'text-stone-900'}`}>{value}</p>
      )}
      {!loading && delta ? <div className="mt-2"><DeltaText delta={delta} /></div> : null}
      {!loading && hint ? <p className="mt-1.5 text-xs leading-relaxed text-stone-600">{hint}</p> : null}
    </>
  );
  // Con enlace, la tarjeta entera es clicable sin anidar el botón de ayuda dentro del <a>.
  return (
    <div className={`relative min-w-0 rounded-2xl border bg-white p-5 shadow-sm ${TONES[tone]} ${href ? 'transition-shadow hover:shadow-md' : ''}`}>
      {href ? <Link href={href} aria-label={label} className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/40" /> : null}
      {body}
    </div>
  );
}
