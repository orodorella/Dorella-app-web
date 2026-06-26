'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight, AlertCircle, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthProvider';
import { useCart } from '@/context/CartProvider';
import { formatCOP } from '@/lib/api-client';

export default function CarritoPage() {
  const { tierInfo, tier } = useAuth();
  const { carrito, updateCantidad, removeFromCart, subtotalPublico, subtotalTier, ahorro, cumpleMinimo, totalItems, nextTier } = useCart();
  const router = useRouter();

  if (carrito.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 px-4 bg-white">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="w-20 h-20 bg-stone-100 rounded-lg flex items-center justify-center mx-auto mb-8">
            <ShoppingBag size={32} className="text-stone-300" />
          </div>
          <h2 className="text-3xl text-stone-800 mb-3" style={{ fontFamily: 'var(--font-display)' }}>Tu carrito está vacío</h2>
          <p className="text-stone-400 mb-10 text-sm font-light">Explora nuestro catálogo y arma tu pedido</p>
          <Link href="/catalogo" className="bg-wine text-white px-10 py-3.5 rounded-lg font-semibold text-sm uppercase tracking-[0.15em] cursor-pointer hover:bg-wine-light transition-colors">
            Ir al catálogo
          </Link>
        </motion.div>
      </div>
    );
  }

  const progressPercent = nextTier
    ? Math.min(100, ((nextTier.key === 'mayorista' ? subtotalPublico : subtotalTier) / (nextTier.key === 'mayorista' ? 500000 : 5000000)) * 100)
    : 100;

  return (
    <div className="flex-1 bg-white min-h-screen relative">
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 py-8">
        <div className="flex items-end justify-between mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl text-stone-800 font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Carrito</h1>
            <p className="text-sm text-stone-400 mt-2 font-light">{carrito.length} referencia(s) — {totalItems} pieza(s)</p>
          </motion.div>
          <Link href="/catalogo" className="text-sm text-wine/50 hover:text-wine transition-colors cursor-pointer font-light">+ Seguir comprando</Link>
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          <div className="bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden">
            <AnimatePresence>
              {carrito.map((item) => {
                const precioTier = (item.product.precioPublico || item.product.precio) * (1 - tierInfo.descuento);
                const subtotalItem = precioTier * item.cantidad;
                const hasDiscount = tierInfo.descuento > 0;
                return (
                  <motion.div key={item.product.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20, height: 0 }}
                    className="flex gap-4 px-5 py-4 border-b border-stone-100 items-center">
                    <div className="w-16 h-16 bg-stone-50 rounded overflow-hidden flex-shrink-0">
                      {item.product.imagen ? <img src={item.product.imagen} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-stone-100" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">{item.product.nombre}</p>
                      <p className="font-functional text-[10px] text-stone-400">{item.product.ref}</p>
                      <div className="flex items-baseline gap-2 mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {hasDiscount && <span className="text-stone-400 line-through text-xs">{formatCOP(item.product.precioPublico || item.product.precio)}</span>}
                        <span className="text-sm font-semibold text-wine">{formatCOP(precioTier)}</span>
                        <span className="text-[10px] text-stone-400">c/u</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => updateCantidad(item.product.id, item.cantidad - 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors text-stone-500"><Minus size={13} /></motion.button>
                      <input type="number" min="1" max={item.product.stock} value={item.cantidad}
                        onChange={(e) => updateCantidad(item.product.id, parseInt(e.target.value) || 0)}
                        className="w-14 text-center py-1.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:border-stone-300" style={{ fontVariantNumeric: 'tabular-nums' }} />
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => updateCantidad(item.product.id, item.cantidad + 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors text-stone-500"><Plus size={13} /></motion.button>
                    </div>
                    <div className="text-right min-w-[90px] hidden sm:block" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <p className="text-sm font-semibold text-stone-700">{formatCOP(subtotalItem)}</p>
                    </div>
                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                      onClick={() => removeFromCart(item.product.id)} className="p-2 text-stone-300 hover:text-red-500 transition-colors cursor-pointer">
                      <Trash2 size={15} />
                    </motion.button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="space-y-4">
            {nextTier && nextTier.faltan > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-50 border border-gold/20 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={16} className="text-gold" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">{tier === 'detal' ? 'Desbloquea descuento' : 'Siguiente nivel'}</p>
                </div>
                <p className="text-sm text-stone-600 mb-4 font-light">
                  Te faltan <span className="font-semibold text-gold">{formatCOP(nextTier.faltan)}</span> para <span className="font-semibold text-stone-800">{nextTier.label}</span> ({(nextTier.descuento * 100).toFixed(1)}% dto.)
                </p>
                <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
                    className="h-full bg-gradient-to-r from-wine to-wine-light rounded-full" />
                </div>
                <p className="font-functional text-[10px] text-stone-400 mt-2 text-right">{progressPercent.toFixed(0)}%</p>
              </motion.div>
            )}

            {!cumpleMinimo && tierInfo.minimo > 0 && (
              <div className="bg-white border border-red-200 rounded-lg p-5 flex gap-3">
                <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Mínimo no alcanzado</p>
                  <p className="text-xs text-stone-500 mt-1 font-light leading-relaxed">
                    El pedido mínimo para {tierInfo.label} es {formatCOP(tierInfo.minimo)}. Te faltan {formatCOP(tierInfo.minimo - subtotalTier)}.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-6">
              <h3 className="text-xl font-semibold text-stone-800 mb-5" style={{ fontFamily: 'var(--font-display)' }}>Resumen</h3>
              <div className="space-y-3 text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <div className="flex justify-between text-stone-500"><span>Subtotal ({totalItems} pzas)</span><span>{formatCOP(subtotalPublico)}</span></div>
                {tierInfo.descuento > 0 && cumpleMinimo && (
                  <div className="flex justify-between text-emerald-600"><span>Dto. {tierInfo.label} ({(tierInfo.descuento * 100).toFixed(1)}%)</span><span>-{formatCOP(ahorro)}</span></div>
                )}
                <div className="border-t border-stone-200 pt-4 flex justify-between items-baseline">
                  <span className="font-semibold text-stone-700">Total</span>
                  <span className="text-3xl font-bold text-wine" style={{ fontFamily: 'var(--font-display)' }}>{formatCOP(cumpleMinimo ? subtotalTier : subtotalPublico)}</span>
                </div>
                {tierInfo.descuento > 0 && cumpleMinimo && <p className="text-xs text-emerald-600 text-right font-light">Ahorras {formatCOP(ahorro)}</p>}
              </div>
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={() => router.push('/checkout')}
                className="w-full mt-6 bg-wine text-white py-4 rounded-lg font-semibold text-sm uppercase tracking-[0.15em] cursor-pointer flex items-center justify-center gap-2 hover:bg-wine-light transition-all duration-300">
                Confirmar Pedido <ArrowRight size={16} />
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
