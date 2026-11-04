'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatInt } from '@/lib/format';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  totalLabel: string;
  onChange: (page: number) => void;
}

export default function Pager({ page, totalPages, total, totalLabel, onChange }: Props) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-stone-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="text-xs text-stone-600">{formatInt(total)} {totalLabel}</p>
      <nav aria-label="Paginación" className="flex items-center gap-2 self-end sm:self-auto">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Página anterior"
          type="button"
          className="cursor-pointer rounded-lg border border-stone-300 p-2 text-stone-700 hover:border-wine/40 hover:bg-wine-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="px-2 text-xs tabular-nums text-stone-700" aria-current="page">{formatInt(page)} / {formatInt(totalPages)}</span>
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          aria-label="Página siguiente"
          type="button"
          className="cursor-pointer rounded-lg border border-stone-300 p-2 text-stone-700 hover:border-wine/40 hover:bg-wine-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={14} />
        </button>
      </nav>
    </div>
  );
}
