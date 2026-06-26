import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, ArrowLeft, MapPin, Phone, FileText } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { orders as ordersApi } from '../services/api'
import { TIER_MAP } from '../services/api'
import { formatCOP } from '../components/PriceDisplay'

export default function Checkout() {
  const {
    user, carrito, dispatch, showToast,
    tierInfo, subtotalPublico, subtotalTier, ahorro, cumpleMinimo, totalItems,
  } = useApp()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('review')

  const total = cumpleMinimo ? subtotalTier : subtotalPublico

  async function handleConfirmar() {
    setLoading(true)
    setStep('processing')
    try {
      const result = await ordersApi.create(carrito)
      if (result.tierUpgraded && result.newTier) {
        const frontendTier = TIER_MAP[result.newTier]
        if (frontendTier) dispatch({ type: 'SET_TIER', payload: frontendTier })
      }
      dispatch({ type: 'CLEAR_CART' })
      navigate('/confirmacion', {
        state: {
          orden: { numeroOrden: result.order.orderNumber, fecha: new Date().toLocaleDateString('es-CO'), estado: 'Confirmado', items: result.order.items.length },
          factura: { numeroFactura: 'Pendiente' },
          seguimiento: { codigo: 'Pendiente', transportadora: 'Por asignar', estimado: '3-5 días hábiles' },
          total: result.order.total,
          ahorro: cumpleMinimo ? ahorro : 0,
          items: totalItems,
          tierUpgraded: result.tierUpgraded,
          newTier: result.newTier,
        },
      })
    } catch (e) {
      setStep('review')
      setLoading(false)
      showToast(e.message, 'error')
    }
  }

  if (carrito.length === 0) {
    navigate('/carrito')
    return null
  }

  return (
    <div className="flex-1 bg-[#FAFAF5] min-h-screen relative">
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-8 py-10">
        <button
          onClick={() => navigate('/carrito')}
          className="flex items-center gap-2 text-sm text-stone-400 hover:text-stone-600 transition-colors mb-8 cursor-pointer"
        >
          <ArrowLeft size={16} /> Volver al carrito
        </button>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl text-stone-800 font-semibold mb-10"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Confirmar Pedido
        </motion.h1>

        {step === 'processing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24"
          >
            <div className="relative w-20 h-20 mx-auto mb-8">
              <div className="absolute inset-0 bg-[#5B0E16]/20 rounded-full animate-ping" />
              <div className="relative w-20 h-20 bg-white border border-stone-200 rounded-full flex items-center justify-center shadow-sm">
                <Loader2 size={32} className="animate-spin text-[#5B0E16]" />
              </div>
            </div>
            <p className="text-xl text-stone-700" style={{ fontFamily: 'var(--font-display)' }}>
              Procesando tu pedido...
            </p>
            <p className="text-sm text-stone-400 mt-3 font-light">
              Generando orden, factura y guía de envío
            </p>
          </motion.div>
        )}

        {step === 'review' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Shipping */}
            <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-7">
              <h3 className="text-lg font-semibold text-stone-800 mb-5 flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
                <div className="w-9 h-9 rounded-lg bg-[#5B0E16]/10 flex items-center justify-center">
                  <MapPin size={16} className="text-[#5B0E16]" />
                </div>
                Datos de Envío
              </h3>
              <div className="grid sm:grid-cols-2 gap-5 text-sm">
                <div>
                  <label className="text-[9px] text-stone-400 uppercase tracking-[0.2em]">Nombre / Razón Social</label>
                  <p className="mt-1.5 text-stone-700">{user?.nombre}</p>
                </div>
                <div>
                  <label className="text-[9px] text-stone-400 uppercase tracking-[0.2em]">Dirección</label>
                  <p className="mt-1.5 text-stone-700">{user?.direccion}</p>
                </div>
                <div>
                  <label className="text-[9px] text-stone-400 uppercase tracking-[0.2em] flex items-center gap-1">
                    <Phone size={10} /> Teléfono
                  </label>
                  <p className="mt-1.5 text-stone-700">{user?.telefono}</p>
                </div>
                <div>
                  <label className="text-[9px] text-stone-400 uppercase tracking-[0.2em]">Tier</label>
                  <p className="mt-1.5">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#C9A84C] bg-[#C9A84C]/10 px-3 py-1 rounded-full border border-[#C9A84C]/20">
                      {tierInfo.label}
                    </span>
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-stone-400 mt-5 italic font-light">
                Datos precargados para la demo
              </p>
            </div>

            {/* Order summary */}
            <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-7">
              <h3 className="text-lg font-semibold text-stone-800 mb-5 flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
                <div className="w-9 h-9 rounded-lg bg-[#5B0E16]/10 flex items-center justify-center">
                  <FileText size={16} className="text-[#5B0E16]" />
                </div>
                Resumen del Pedido
              </h3>

              <div className="max-h-60 overflow-y-auto divide-y divide-stone-100 mb-5 pr-2">
                {carrito.map((item) => {
                  const precio = item.product.precioPublico * (1 - (cumpleMinimo ? tierInfo.descuento : 0))
                  return (
                    <div key={item.product.id} className="flex justify-between py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <span className="text-stone-700 truncate block">{item.product.nombre}</span>
                        <span className="font-functional text-[10px] text-stone-400">{item.product.ref} × {item.cantidad}</span>
                      </div>
                      <span className="font-medium text-stone-600 ml-4" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCOP(precio * item.cantidad)}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-stone-200 pt-5 space-y-2.5 text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <div className="flex justify-between text-stone-500">
                  <span>Subtotal ({totalItems} pzas)</span>
                  <span>{formatCOP(subtotalPublico)}</span>
                </div>
                {cumpleMinimo && tierInfo.descuento > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Dto. {tierInfo.label}</span>
                    <span>-{formatCOP(ahorro)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-3 border-t border-stone-200">
                  <span className="font-semibold text-stone-700">Total a pagar</span>
                  <span className="text-3xl font-bold text-[#5B0E16]" style={{ fontFamily: 'var(--font-display)' }}>
                    {formatCOP(total)}
                  </span>
                </div>
                {cumpleMinimo && ahorro > 0 && (
                  <p className="text-xs text-emerald-600 text-right font-light">
                    Ahorras {formatCOP(ahorro)} en este pedido
                  </p>
                )}
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleConfirmar}
              disabled={loading}
              className="w-full bg-[#5B0E16] text-white py-4.5 rounded-lg font-semibold text-sm uppercase tracking-[0.15em] disabled:opacity-30 cursor-pointer flex items-center justify-center gap-2 hover:bg-[#6d1a23] transition-all duration-300"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              Confirmar y Generar Orden
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
