import { useState, useEffect } from 'react'
import { admin } from '../../services/api'
import { formatCOP } from '../../components/PriceDisplay'
import { Users, ShoppingBag, DollarSign, Clock, Loader2, TrendingUp } from 'lucide-react'

const TIER_LABELS = { detal: 'Detal', por_mayor: 'Por Mayor', gran_mayor: 'Gran Mayor' }
const TIER_COLORS = {
  detal: 'bg-stone-100 text-stone-600',
  por_mayor: 'bg-gold/10 text-gold-dark border border-gold/20',
  gran_mayor: 'bg-wine/10 text-wine border border-wine/20',
}
const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-blue-50 text-blue-700',
  invoiced: 'bg-blue-50 text-blue-700',
  shipped: 'bg-purple-50 text-purple-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700',
}
const STATUS_LABELS = {
  pending: 'Pendiente', confirmed: 'Confirmado', invoiced: 'Facturado',
  shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [recentOrders, setRecentOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      admin.getStats(),
      admin.getOrders({ pageSize: 10 }),
    ]).then(([s, o]) => {
      setStats(s)
      setRecentOrders(o.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-wine" /></div>
  }

  const kpis = [
    { label: 'Usuarios', value: stats?.total ?? 0, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Órdenes totales', value: stats?.totalOrders ?? 0, icon: ShoppingBag, color: 'text-purple-600 bg-purple-50' },
    { label: 'Pendientes', value: stats?.pendingOrders ?? 0, icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { label: 'Ingresos', value: formatCOP(stats?.totalRevenue ?? 0), icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
  ]

  return (
    <div>
      <h1 className="text-3xl text-stone-800 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Dashboard</h1>
      <p className="text-sm text-stone-400 mb-8">Resumen general de D'orella</p>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-10">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2.5 rounded-lg ${k.color}`}><k.icon size={18} /></div>
              <span className="text-xs text-stone-400 uppercase tracking-wider font-medium">{k.label}</span>
            </div>
            <p className="text-2xl font-bold text-stone-800" style={{ fontVariantNumeric: 'tabular-nums' }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tier breakdown */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm mb-10">
        <h2 className="text-lg font-semibold text-stone-800 mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
          <TrendingUp size={18} className="text-wine" /> Usuarios por Tier
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(stats?.byTier ?? {}).map(([tier, count]) => (
            <div key={tier} className="text-center p-4 rounded-lg bg-ivory">
              <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full ${TIER_COLORS[tier] || ''}`}>
                {TIER_LABELS[tier] || tier}
              </span>
              <p className="text-2xl font-bold text-stone-800 mt-2">{count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-stone-100">
          <h2 className="text-lg font-semibold text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Órdenes Recientes</h2>
        </div>
        {recentOrders.length === 0 ? (
          <div className="text-center py-12 text-stone-400">No hay órdenes aún</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-stone-400 uppercase tracking-wider border-b border-stone-100">
                  <th className="text-left px-6 py-3 font-medium">Orden</th>
                  <th className="text-left px-6 py-3 font-medium">Usuario</th>
                  <th className="text-left px-6 py-3 font-medium">Tier</th>
                  <th className="text-right px-6 py-3 font-medium">Total</th>
                  <th className="text-left px-6 py-3 font-medium">Estado</th>
                  <th className="text-left px-6 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o, i) => (
                  <tr key={o.id} className={i % 2 === 0 ? 'bg-white' : 'bg-ivory/50'}>
                    <td className="px-6 py-3.5 font-medium text-stone-700">{o.orderNumber}</td>
                    <td className="px-6 py-3.5 text-stone-600">{o.user?.nombre} {o.user?.apellido}</td>
                    <td className="px-6 py-3.5">
                      <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${TIER_COLORS[o.tierAtPurchase] || ''}`}>
                        {TIER_LABELS[o.tierAtPurchase] || o.tierAtPurchase}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-medium text-stone-700" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCOP(o.total)}</td>
                    <td className="px-6 py-3.5">
                      <span className={`text-[9px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_STYLES[o.status] || ''}`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-stone-400 text-xs">{new Date(o.createdAt).toLocaleDateString('es-CO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
