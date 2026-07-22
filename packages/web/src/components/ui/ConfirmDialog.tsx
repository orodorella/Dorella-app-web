'use client';

import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  danger = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-50' : 'bg-wine/10'}`}>
            <AlertTriangle size={18} className={danger ? 'text-red-500' : 'text-wine'} />
          </div>
          <div>
            <h3 className="text-[15px] text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>{title}</h3>
            <p className="text-sm text-stone-500 mt-1 font-light leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer">
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-wine hover:bg-wine-light'
            }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
