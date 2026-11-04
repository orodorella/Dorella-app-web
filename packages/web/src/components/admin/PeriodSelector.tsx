'use client';

import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { PRESET_LABELS, STANDARD_PRESETS, todayBogota, type PeriodPreset, type ResolvedPeriod } from '@/lib/admin-period';
import { field } from '@/components/admin/styles';

interface Props {
  period: ResolvedPeriod;
  onChange: (preset: PeriodPreset, custom?: { from: string; to: string }) => void;
  presets?: PeriodPreset[];
  /** Aviso bajo el selector, p. ej. qué periodos no admite la pantalla. */
  note?: string;
}

/** Selector de periodo compartido del panel. El estado vive en la URL (ver usePeriod). */
export default function PeriodSelector({ period, onChange, presets = STANDARD_PRESETS, note }: Props) {
  const [draft, setDraft] = useState({ from: period.from, to: period.to });
  useEffect(() => { setDraft({ from: period.from, to: period.to }); }, [period.from, period.to]);
  const today = todayBogota();

  function changeDraft(next: { from: string; to: string }) {
    setDraft(next);
    // Solo se aplica un rango completo y en orden; mientras tanto el informe no se recarga.
    if (next.from && next.to && next.from <= next.to) onChange('custom', next);
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div role="group" aria-label="Periodo" className="flex flex-wrap items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
        {presets.map((preset) => {
          const active = period.preset === preset;
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={active}
              onClick={() => (preset === 'custom' ? onChange('custom', { from: period.from, to: period.to }) : onChange(preset))}
              className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? 'bg-wine text-white shadow-sm' : 'text-stone-600 hover:bg-wine-50 hover:text-wine'
              }`}
            >
              {PRESET_LABELS[preset]}
            </button>
          );
        })}
      </div>

      {period.preset === 'custom' ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-stone-600">
            Desde
            <input type="date" value={draft.from} max={draft.to || today} onChange={(e) => changeDraft({ ...draft, from: e.target.value })} className={`${field} mt-1 block`} />
          </label>
          <label className="text-xs font-medium text-stone-600">
            Hasta
            <input type="date" value={draft.to} min={draft.from} max={today} onChange={(e) => changeDraft({ ...draft, to: e.target.value })} className={`${field} mt-1 block`} />
          </label>
        </div>
      ) : null}

      <p className="flex items-center gap-1.5 text-xs text-stone-600">
        <CalendarDays size={14} aria-hidden className="shrink-0 text-stone-500" />
        <span>
          {period.rangeLabel}
          {period.partial ? ' · mes en curso' : ''}
        </span>
      </p>
      {note ? <p className="text-xs text-stone-500">{note}</p> : null}
    </div>
  );
}
