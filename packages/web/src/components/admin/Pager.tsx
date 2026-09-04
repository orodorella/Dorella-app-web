'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

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
      <p className="text-xs text-stone-400">{total} {totalLabel}</p>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="cursor-pointer rounded border border-stone-200 p-2 hover:bg-stone-50 disabled:opacity-30"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="px-2 text-xs text-stone-500">{page} / {totalPages}</span>
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="cursor-pointer rounded border border-stone-200 p-2 hover:bg-stone-50 disabled:opacity-30"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
