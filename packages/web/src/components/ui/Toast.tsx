'use client';

import { useToast } from '@/context/ToastProvider';

export default function Toast() {
  const { toast } = useToast();
  if (!toast) return null;

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-luxury text-sm toast-enter ${
      toast.type === 'error'
        ? 'bg-red-50 text-red-700 border border-red-200'
        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    }`}>
      {toast.message}
    </div>
  );
}
