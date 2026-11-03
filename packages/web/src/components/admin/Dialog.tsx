'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** 'center' = diálogo modal; 'side' = panel lateral derecho. */
  variant?: 'center' | 'side';
  size?: 'sm' | 'md' | 'lg';
}

const WIDTHS = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

/** Diálogo o panel lateral del panel: cierra con Escape o clic fuera y enfoca su contenido al abrir. */
export default function Dialog({ open, title, onClose, children, footer, variant = 'center', size = 'md' }: Props) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  // onClose suele ser una función en línea: se guarda en ref para no re-ejecutar el efecto (y robar el foco) en cada render.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [open]);

  if (!open) return null;
  const side = variant === 'side';

  return (
    <div className={`fixed inset-0 z-50 flex bg-black/40 ${side ? 'justify-end' : 'items-center justify-center p-4'}`} onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`flex w-full flex-col bg-white shadow-2xl outline-none ${side ? 'h-full max-w-md' : `max-h-[88vh] rounded-2xl ${WIDTHS[size]}`}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <h2 id={titleId} className="text-lg text-stone-900" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="cursor-pointer rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-stone-700">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}
