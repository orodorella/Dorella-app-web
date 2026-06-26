import { useApp } from '../context/AppContext'

function formatCOP(n) {
  return '$' + Math.round(n).toLocaleString('es-CO')
}

export default function PriceDisplay({ precioPublico, precio, cantidad = 1, showUnit = true }) {
  const { tierInfo } = useApp()

  const precioFinal = precio || precioPublico * (1 - tierInfo.descuento)
  const precioOriginal = precioPublico || precio
  const hasDiscount = tierInfo.descuento > 0 && precioPublico && precio && precioPublico !== precio

  return (
    <div className="font-functional flex items-baseline gap-2">
      {hasDiscount && (
        <span className="text-stone-400 line-through text-xs">{formatCOP(precioOriginal * cantidad)}</span>
      )}
      <span className={`font-semibold ${tierInfo.descuento > 0 ? 'text-wine' : 'text-stone-800'}`}>
        {formatCOP(precioFinal * cantidad)}
      </span>
      {tierInfo.descuento > 0 && showUnit && cantidad === 1 && (
        <span className="text-[10px] text-wine/50 font-medium">-{(tierInfo.descuento * 100).toFixed(1)}%</span>
      )}
    </div>
  )
}

export { formatCOP }
