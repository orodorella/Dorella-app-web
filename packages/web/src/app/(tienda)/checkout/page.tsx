'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, ArrowLeft, MapPin, Phone, FileText } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useCart } from '@/context/CartProvider';
import { useToast } from '@/context/ToastProvider';
import { formatCOP, TIER_MAP } from '@/lib/api-client';
import { request } from '@/hooks/useApi';

export default function CheckoutPage() {
  const { user, tierInfo, setTier } = useAuth();
  const { carrito, clearCart, subtotalPublico, subtotalTier, ahorro, cumpleMinimo, totalItems } = useCart();
  const { showToast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'review' | 'processing'>('review');

  const total = cumpleMinimo ? subtotalTier : subtotalPublico;

  async function handleConfirmar() {
    setLoading(true);
    setStep('processing');
    try {
      const res = await request('POST', '/api/orders', {
        items: carrito.map((i) => ({ productId: i.product.id, cantidad: i.cantidad })),
      });
      if (!res.success) throw new Error(res.error?.message || 'Error creando orden');
      const result = res.data;

      if (result.tierUpgraded && result.newTier) {
        const frontendTier = TIER_MAP[result.newTier];
        if (frontendTier) setTier(frontendTier);
      }
      clearCart();
      router.push(`/confirmacion?orden=${result.order.orderNumber}&total=${result.order.total}&items=${totalItems}`);
    } catch (e) {
      setStep('review');
      setLoading(false);
      showToast((e as Error).message, 'error');
    }
  }

  if (carrito.length === 0 && step !== 'processing') {
    router.push('/carrito');
    return null;
  }

  return (
    <div className="flex-1 bg-ivory min-h-screen relative">
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-8 py-10">
        <button onClick={() => router.push('/carrito')} className="flex items-center gap-2 text-sm text-stone-400 hover:text-stone-600 transition-colors mb-8 cursor-pointer">
          <ArrowLeft size={16} /> Volver al carrito
        </button>

        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-4xl text-stone-800 font-semibold mb-10" style={{ fontFamily: 'var(--font-display)' }}>Confirmar Pedido</motion.h1>

        {step === 'processing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
            <div className="relative w-20 h-20 mx-auto mb-8">
              <div className="absolute inset-0 bg-wine/20 rounded-full animate-ping" />
              <div className="relative w-20 h-20 bg-white border border-stone-200 rounded-full flex items-center justify-center shadow-sm">
                <Loader2 size={32} className="animate-spin text-wine" />
              </div>
            </div>
            <p className="text-xl text-stone-700" style={{ fontFamily: 'var(--font-display)' }}>Procesando tu pedido...</p>
            <p className="text-sm text-stone-400 mt-3 font-light">Generando orden y factura</p>
          </motion.div>
        )}

        {step === 'review' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-7">
              <h3 className="text-lg font-semibold text-stone-800 mb-5 flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
                <div className="w-9 h-9 rounded-lg bg-wine/10 flex items-center justify-center"><MapPin size={16} className="text-wine" /></div>
                Datos de Envío
              </h3>
              <div className="grid sm:grid-cols-2 gap-5 text-sm">
                <div><span className="text-[9px] text-stone-400 uppercase tracking-[0.2em]">Nombre</span><p className="mt-1.5 text-stone-700">{user?.nombre}</p></div>
                <div><span className="text-[9px] text-stone-400 uppercase tracking-[0.2em]">Dirección</span><p className="mt-1.5 text-stone-700">{user?.direccion || '—'}</p></div>
                <div><span className="text-[9px] text-stone-400 uppercase tracking-[0.2em] flex items-center gap-1"><Phone size={10} /> Teléfono</span><p className="mt-1.5 text-stone-700">{user?.telefono || '—'}</p></div>
                <div><span className="text-[9px] text-stone-400 uppercase tracking-[0.2em]">Tier</span>
                  <p className="mt-1.5"><span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-gold bg-gold/10 px-3 py-1 rounded-full border border-gold/20">{tierInfo.label}</span></p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-7">
              <h3 className="text-lg font-semibold text-stone-800 mb-5 flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
                <div className="w-9 h-9 rounded-lg bg-wine/10 flex items-center justify-center"><FileText size={16} className="text-wine" /></div>
                Resumen del Pedido
              </h3>
              <div className="max-h-60 overflow-y-auto divide-y divide-stone-100 mb-5 pr-2">
                {carrito.map((item) => {
                  const precio = (item.product.precioPublico || item.product.precio) * (1 - (cumpleMinimo ? tierInfo.descuento : 0));
                  return (
                    <div key={item.product.id} className="flex justify-between py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <span className="text-stone-700 truncate block">{item.product.nombre}</span>
                        <span className="font-functional text-[10px] text-stone-400">{item.product.ref} × {item.cantidad}</span>
                      </div>
                      <span className="font-medium text-stone-600 ml-4" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCOP(precio * item.cantidad)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-stone-200 pt-5 space-y-2.5 text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <div className="flex justify-between text-stone-500"><span>Subtotal ({totalItems} pzas)</span><span>{formatCOP(subtotalPublico)}</span></div>
                {cumpleMinimo && tierInfo.descuento > 0 && <div className="flex justify-between text-emerald-600"><span>Dto. {tierInfo.label}</span><span>-{formatCOP(ahorro)}</span></div>}
                <div className="flex justify-between items-baseline pt-3 border-t border-stone-200">
                  <span className="font-semibold text-stone-700">Total a pagar</span>
                  <span className="text-3xl font-bold text-wine" style={{ fontFamily: 'var(--font-display)' }}>{formatCOP(total)}</span>
                </div>
                {cumpleMinimo && ahorro > 0 && <p className="text-xs text-emerald-600 text-right font-light">Ahorras {formatCOP(ahorro)}</p>}
              </div>
            </div>

            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleConfirmar} disabled={loading}
              className="w-full bg-wine text-white py-4.5 rounded-lg font-semibold text-sm uppercase tracking-[0.15em] disabled:opacity-30 cursor-pointer flex items-center justify-center gap-2 hover:bg-wine-light transition-all duration-300">
              {loading && <Loader2 size={18} className="animate-spin" />}
              Confirmar y Generar Orden
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
