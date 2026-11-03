'use client';

import { useRef } from 'react';

interface Tab<T extends string> { id: T; label: string; badge?: string | number }

/** Pestañas accesibles (flechas izquierda/derecha); el contenido lo pinta la pantalla con `tabPanelProps`. */
export default function Tabs<T extends string>({ tabs, active, onChange, label }: { tabs: Tab<T>[]; active: T; onChange: (id: T) => void; label: string }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className="mb-6 flex gap-1 overflow-x-auto border-b border-stone-200">
      {tabs.map((tab, i) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`-mb-px flex cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              selected ? 'border-wine text-wine' : 'border-transparent text-stone-600 hover:border-stone-300 hover:text-stone-900'
            }`}
          >
            {tab.label}
            {tab.badge !== undefined ? <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700">{tab.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export const tabPanelProps = (id: string) => ({ role: 'tabpanel' as const, id: `panel-${id}`, 'aria-labelledby': `tab-${id}`, tabIndex: 0 });
