import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, ChevronDown, Eye, Loader2 } from 'lucide-react'
import { orders as ordersApi } from '../services/api'
import { formatCOP } from '../components/PriceDisplay'

const estadoStyles = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  invoiced: 'bg-blue-50 text-blue-700 border-blue-200',
  shipped: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

const estadoLabels = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  invoiced: 'Facturado',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

export default function MisPedidos() {
  const [expandedId, setExpandedId] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ordersApi.getAll().then((res) => {
      setOrders(res.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex-1 bg-white min-h-screen">
      <div className="max-w-[900px] mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl text-stone-800 font-semibold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            Mis Pedidos
          </h1>
          <p className="text-sm text-stone-400 font-light mb-10">
            Historial de pedidos y seguimiento
          </p>
        </motion.div>

        {loading ? (
          <div className="text-center py-20">
            <Loader2 size={32} className="animate-spin text-wine mx-auto mb-4" />
            <p className="text-stone-400 text-sm">Cargando pedidos...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <Package size={48} className="text-stone-200 mx-auto mb-4" />
            <p className="text-stone-500" style={{ fontFamily: 'var(--font-display)' }}>No tienes pedidos aún</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order, i) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="border border-stone-200 rounded-lg overflow-hidden"
              >
                {/* Order header */}
                <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-functional text-sm font-semibold text-stone-800">{order.orderNumber}</p>
                      <span className={`text-[9px] font-semibold uppercase tracking-[0.1em] px-2.5 py-0.5 rounded-full border ${estadoStyles[order.status] || estadoStyles.pending}`}>
                        {estadoLabels[order.status] || order.status}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400">{new Date(order.createdAt).toLocaleDateString('es-CO')} — {order.items.reduce((s, i) => s + i.cantidad, 0)} piezas</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-lg font-semibold text-stone-800" style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCOP(order.total)}
                    </p>
                    <button
                      onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                      className="flex items-center gap-1 text-xs text-wine hover:text-wine-light cursor-pointer transition-colors px-3 py-2 border border-stone-200 rounded"
                    >
                      <Eye size={14} />
                      <span className="hidden sm:inline">Detalle</span>
                      <ChevronDown size={14} className={`transition-transform duration-300 ${expandedId === order.id ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                <AnimatePresence>
                  {expandedId === order.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 border-t border-stone-100">
                        <div className="pt-4">
                          <p className="text-[10px] text-stone-400 uppercase tracking-[0.15em] font-semibold mb-3">Productos</p>
                          <div className="space-y-2">
                            {order.items.map((item) => (
                              <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                                <div className="flex-1 min-w-0">
                                  <span className="text-stone-700">{item.nombreProducto}</span>
                                  <span className="font-functional text-stone-400 text-xs ml-2">{item.sku}</span>
                                </div>
                                <div className="flex items-center gap-6 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                  <span className="text-stone-400 text-xs">×{item.cantidad}</span>
                                  <span className="text-stone-400 text-xs w-20">{formatCOP(item.precioUnitario)} c/u</span>
                                  <span className="text-stone-700 font-medium w-24">{formatCOP(item.subtotal)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="border-t border-stone-100 mt-3 pt-3 flex justify-between items-baseline">
                            <span className="text-sm font-semibold text-stone-600">Total del pedido</span>
                            <span className="text-xl font-bold text-wine" style={{ fontFamily: 'var(--font-display)' }}>
                              {formatCOP(order.total)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
