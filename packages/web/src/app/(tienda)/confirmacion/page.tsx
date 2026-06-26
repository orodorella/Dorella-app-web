'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle, FileText, Sparkles, Copy } from 'lucide-react';
import { useState, Suspense } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { formatCOP } from '@/lib/api-client';

function ConfirmacionContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [copied, setCopied] = useState('');

  const orden = searchParams.get('orden');
  const total = Number(searchParams.get('total') || 0);
  const items = Number(searchParams.get('items') || 0);

  if (!orden) return <Link href="/" className="text-wine">Ir al inicio</Link>;

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  }

  return (
    <div className="flex-1 bg-ivory min-h-screen relative overflow-hidden">
      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-8 py-16">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }} className="text-center mb-14">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 bg-emerald-500/15 rounded-full animate-ping" />
            <div className="relative w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-200">
              <CheckCircle size={40} className="text-emerald-500" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl text-stone-800 font-semibold mb-3" style={{ fontFamily: 'var(--font-display)' }}>Pedido Confirmado</h1>
          <p className="text-stone-500 font-light flex items-center justify-center gap-2">
            <Sparkles size={14} className="text-gold" /> Gracias, {user?.nombre} <Sparkles size={14} className="text-gold" />
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white border border-stone-200 rounded-lg shadow-sm p-7 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-wine/10 flex items-center justify-center flex-shrink-0">
              <FileText size={18} className="text-wine" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Orden de Compra</h3>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-400">Número de orden</span>
                  <button onClick={() => copyToClipboard(orden, 'orden')}
                    className="font-functional flex items-center gap-1.5 font-bold text-stone-800 cursor-pointer hover:text-wine transition-colors">
                    {orden}
                    <Copy size={11} className={copied === 'orden' ? 'text-emerald-500' : 'text-stone-400'} />
                  </button>
                </div>
                <div className="flex justify-between"><span className="text-stone-400">Ítems</span><span className="text-stone-600">{items} piezas</span></div>
                <div className="flex justify-between"><span className="text-stone-400">Estado</span>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">Confirmado</span>
                </div>
              </div>
              {total > 0 && (
                <div className="border-t border-stone-200 pt-4 mt-5 flex justify-between items-baseline" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <span className="font-semibold text-stone-600">Total</span>
                  <span className="text-2xl font-bold text-wine" style={{ fontFamily: 'var(--font-display)' }}>{formatCOP(total)}</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
          className="mt-12 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/catalogo"
            className="inline-flex items-center justify-center gap-2 bg-wine text-white px-10 py-3.5 rounded-lg font-semibold text-sm uppercase tracking-[0.15em] cursor-pointer hover:bg-wine-light transition-colors">
            Hacer otro pedido
          </Link>
          <Link href="/"
            className="inline-flex items-center justify-center gap-2 border border-stone-300 text-stone-500 px-10 py-3.5 rounded-lg font-medium text-sm uppercase tracking-[0.15em] hover:border-wine/30 hover:text-stone-700 transition-all cursor-pointer">
            Ir al inicio
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

export default function ConfirmacionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ivory" />}>
      <ConfirmacionContent />
    </Suspense>
  );
}
