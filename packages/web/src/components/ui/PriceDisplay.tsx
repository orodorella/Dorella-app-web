import { formatCOP } from '@/lib/api-client';

interface PriceDisplayProps {
  precio: number;
  precioPublico?: number;
  cantidad?: number;
  showUnit?: boolean;
  descuento?: number;
}

export default function PriceDisplay({ precio, precioPublico, cantidad = 1, showUnit = true, descuento = 0 }: PriceDisplayProps) {
  const hasDiscount = descuento > 0 && precioPublico && precioPublico !== precio;

  return (
    <div className="font-functional flex items-baseline gap-2">
      {hasDiscount && (
        <span className="text-stone-400 line-through text-xs">{formatCOP(precioPublico * cantidad)}</span>
      )}
      <span className={`font-semibold ${descuento > 0 ? 'text-wine' : 'text-stone-800'}`}>
        {formatCOP(precio * cantidad)}
      </span>
      {descuento > 0 && showUnit && cantidad === 1 && (
        <span className="text-[10px] text-wine/50 font-medium">-{(descuento * 100).toFixed(1)}%</span>
      )}
    </div>
  );
}
