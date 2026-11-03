'use client';

import { useId } from 'react';
import { Info } from 'lucide-react';

/** Ícono con explicación al pasar el cursor o al enfocar (teclado y toque). */
export default function InfoTip({ label, text }: { label: string; text: string }) {
  const id = useId();
  return (
    <span className="group/tip relative z-10 inline-flex align-middle">
      <button
        type="button"
        aria-label={`Qué cuenta: ${label}`}
        aria-describedby={id}
        className="cursor-help rounded-full p-0.5 text-stone-500 transition-colors hover:text-wine focus-visible:text-wine focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/40"
      >
        <Info size={14} aria-hidden />
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none invisible absolute left-0 top-full z-30 mt-1.5 w-72 max-w-[calc(100vw-3rem)] rounded-lg bg-deep px-3 py-2 text-xs font-normal normal-case leading-relaxed tracking-normal text-ivory opacity-0 shadow-lg transition-opacity group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
