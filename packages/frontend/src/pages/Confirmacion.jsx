import { useLocation, Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, FileText, Truck, Copy, Sparkles } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatCOP } from '../components/PriceDisplay'
import { useState } from 'react'

export default function Confirmacion() {
  const location = useLocation()
  const { user } = useApp()
  const [copied, setCopied] = useState('')
  const data = location.state

  if (!data) return <Navigate to="/" replace />

  const { orden, factura, seguimiento, total, ahorro, items } = data

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div className="flex-1 bg-[#FAFAF5] min-h-screen relative overflow-hidden">
      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-8 py-16">
        {/* Success */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="text-center mb-14"
        >
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 bg-emerald-500/15 rounded-full animate-ping" />
            <div className="relative w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-200">
              <CheckCircle size={40} className="text-emerald-500" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl text-stone-800 font-semibold mb-3" style={{ fontFamily: 'var(--font-display)' }}>
            Pedido Confirmado
          </h1>
          <p className="text-stone-500 font-light flex items-center justify-center gap-2">
            <Sparkles size={14} className="text-[#C9A84C]" />
            Gracias, {user?.nombre}
            <Sparkles size={14} className="text-[#C9A84C]" />
          </p>
        </motion.div>

        {/* Cards */}
        <div className="space-y-4">
          {/* Order */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white border border-stone-200 rounded-lg shadow-sm p-7"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#5B0E16]/10 flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-[#5B0E16]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                  Orden de Compra
                </h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-stone-400">Número de orden</span>
                    <button
                      onClick={() => copyToClipboard(orden.numeroOrden, 'orden')}
                      className="font-functional flex items-center gap-1.5 font-bold text-stone-800 cursor-pointer hover:text-[#5B0E16] transition-colors"
                    >
                      {orden.numeroOrden}
                      <Copy size={11} className={copied === 'orden' ? 'text-emerald-500' : 'text-stone-400 hover:text-[#5B0E16]'} />
                    </button>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Fecha</span>
                    <span className="text-stone-600">{orden.fecha}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Estado</span>
                    <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                      {orden.estado}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Ítems</span>
                    <span className="text-stone-600">{items} piezas</span>
                  </div>
                </div>

                <div className="border-t border-stone-200 pt-4 mt-5" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold text-stone-600">Total pagado</span>
                    <span className="text-2xl font-bold text-[#5B0E16]" style={{ fontFamily: 'var(--font-display)' }}>
                      {formatCOP(total)}
                    </span>
                  </div>
                  {ahorro > 0 && (
                    <p className="text-xs text-emerald-600 text-right mt-1 font-light">
                      Ahorraste {formatCOP(ahorro)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Invoice */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white border border-stone-200 rounded-lg shadow-sm p-7"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-[#C9A84C]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                  Factura Electrónica
                </h3>
                <div className="mt-3 space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-stone-400">Número</span>
                    <button
                      onClick={() => copyToClipboard(factura.numeroFactura, 'factura')}
                      className="font-functional flex items-center gap-1.5 font-semibold text-stone-800 cursor-pointer hover:text-[#5B0E16] transition-colors"
                    >
                      {factura.numeroFactura}
                      <Copy size={11} className={copied === 'factura' ? 'text-emerald-500' : 'text-stone-400 hover:text-[#5B0E16]'} />
                    </button>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Emisión</span>
                    <span className="text-stone-600">{factura.fecha}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Tracking */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white border border-stone-200 rounded-lg shadow-sm p-7"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center flex-shrink-0">
                <Truck size={18} className="text-[#C9A84C]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                  Seguimiento de Envío
                </h3>
                <div className="mt-3 space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-stone-400">Guía</span>
                    <button
                      onClick={() => copyToClipboard(seguimiento.codigo, 'guia')}
                      className="font-functional flex items-center gap-1.5 font-semibold text-stone-800 cursor-pointer hover:text-[#5B0E16] transition-colors"
                    >
                      {seguimiento.codigo}
                      <Copy size={11} className={copied === 'guia' ? 'text-emerald-500' : 'text-stone-400 hover:text-[#5B0E16]'} />
                    </button>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Transportadora</span>
                    <span className="text-stone-600">{seguimiento.transportadora}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Estimado</span>
                    <span className="text-stone-600">{seguimiento.estimado}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-12 flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Link
            to="/catalogo"
            className="inline-flex items-center justify-center gap-2 bg-[#5B0E16] text-white px-10 py-3.5 rounded-lg font-semibold text-sm uppercase tracking-[0.15em] cursor-pointer hover:bg-[#6d1a23] transition-colors"
          >
            Hacer otro pedido
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 border border-stone-300 text-stone-500 px-10 py-3.5 rounded-lg font-medium text-sm uppercase tracking-[0.15em] hover:border-[#5B0E16]/30 hover:text-stone-700 transition-all cursor-pointer"
          >
            Ir al inicio
          </Link>
        </motion.div>

        <p className="text-center text-stone-400 text-[9px] mt-12 tracking-[0.3em] uppercase">
          Datos simulados — Prototipo de validación
        </p>
      </div>
    </div>
  )
}
