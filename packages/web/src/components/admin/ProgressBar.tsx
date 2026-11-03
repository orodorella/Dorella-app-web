import { formatInt, formatPct } from '@/lib/format';

/** Barra "X de N" con porcentaje; accesible como progressbar. */
export default function ProgressBar({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs text-stone-700">
        <span>{label}</span>
        <span className="tabular-nums"><strong className="font-semibold text-stone-900">{formatInt(value)}</strong> de {formatInt(total)} · {formatPct(pct, { digits: pct > 0 && pct < 1 ? 1 : 0 })}</span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={value} className="h-2 overflow-hidden rounded-full bg-stone-200">
        <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-600' : 'bg-gold'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
