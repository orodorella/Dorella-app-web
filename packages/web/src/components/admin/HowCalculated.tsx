import { ChevronDown, HelpCircle } from 'lucide-react';

interface Props {
  /** Reglas de cálculo (siempre ciertas). */
  rules?: string[];
  /** Avisos sobre los datos del periodo (p. ej. faltan costos). Se destacan y se cuentan en el resumen. */
  warnings?: string[];
  children?: React.ReactNode;
}

/** Bloque colapsable con las definiciones y avisos que antes ocupaban la parte superior de cada pantalla. */
export default function HowCalculated({ rules = [], warnings = [], children }: Props) {
  if (rules.length === 0 && warnings.length === 0 && !children) return null;
  return (
    <details className="group rounded-xl border border-stone-200 bg-white text-sm shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-stone-700 [&::-webkit-details-marker]:hidden">
        <HelpCircle size={16} aria-hidden className="text-stone-500" />
        <span className="font-medium">Cómo se calcula</span>
        {warnings.length > 0 ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
            {warnings.length} {warnings.length === 1 ? 'aviso' : 'avisos'}
          </span>
        ) : null}
        <ChevronDown size={16} aria-hidden className="ml-auto text-stone-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-stone-100 px-4 py-3 text-stone-700">
        {warnings.length > 0 ? (
          <ul className="list-disc space-y-1 rounded-lg bg-amber-50 py-2 pl-8 pr-3 text-amber-900">
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        ) : null}
        {rules.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5">
            {rules.map((r) => <li key={r}>{r}</li>)}
          </ul>
        ) : null}
        {children}
      </div>
    </details>
  );
}
