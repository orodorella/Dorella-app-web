'use client';

import Image from 'next/image';
import { formatCOP } from '@/lib/api-client';
import { AlertTriangle, ArrowDown, ArrowRight, CheckCircle } from 'lucide-react';

interface Product {
  productId: string;
  sku: string;
  nombre: string;
  stock: number;
  imagenes: string[];
  totalSold: number;
  averageDaily: number;
  daysOfInventory: number | null;
  totalRevenue: number;
  averageDailyRevenue: number;
}

interface Props {
  data: Product[];
}

function getUrgency(days: number | null): { label: string; color: string; bg: string; icon: typeof AlertTriangle } {
  if (days === null) return { label: 'Sin datos', color: 'text-stone-500', bg: 'bg-stone-100', icon: AlertTriangle };
  if (days < 3) return { label: 'Crítico', color: 'text-red-700', bg: 'bg-red-50', icon: ArrowDown };
  if (days < 7) return { label: 'Urgente', color: 'text-amber-700', bg: 'bg-amber-50', icon: AlertTriangle };
  if (days < 14) return { label: 'Medio', color: 'text-yellow-700', bg: 'bg-yellow-50', icon: ArrowRight };
  return { label: 'Bajo', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle };
}

function getStockColor(stock: number): string {
  if (stock === 0) return 'text-red-600 font-semibold';
  if (stock < 10) return 'text-amber-600';
  return 'text-stone-700';
}

function getDaysColor(days: number | null): string {
  if (days === null) return 'text-stone-400';
  if (days < 3) return 'text-red-600 font-semibold';
  if (days < 7) return 'text-amber-600 font-medium';
  if (days < 14) return 'text-yellow-600';
  return 'text-emerald-600';
}

export default function RestockingTable({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-stone-400 text-sm">
        <CheckCircle size={18} className="mr-2 text-emerald-500" />
        Todos los productos tienen inventario suficiente
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] text-stone-400 uppercase tracking-wider border-b border-stone-100">
            <th className="text-left px-5 py-3 font-medium">Producto</th>
            <th className="text-right px-5 py-3 font-medium">Vendidos (30d)</th>
            <th className="text-right px-5 py-3 font-medium">Diario</th>
            <th className="text-right px-5 py-3 font-medium">Stock</th>
            <th className="text-right px-5 py-3 font-medium">Días Restantes</th>
            <th className="text-right px-5 py-3 font-medium">Pedido Sugerido</th>
            <th className="text-right px-5 py-3 font-medium">Ingresos (30d)</th>
            <th className="text-center px-5 py-3 font-medium">Urgencia</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p, i) => {
            const urgency = getUrgency(p.daysOfInventory);
            const suggestedOrder = p.averageDaily > 0 ? Math.max(0, Math.ceil(30 * p.averageDaily - p.stock)) : 0;
            const UrgencyIcon = urgency.icon;
            return (
              <tr key={p.productId} className={`${i % 2 === 0 ? 'bg-white' : 'bg-ivory/50'} hover:bg-stone-50 transition-colors`}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    {p.imagenes?.[0] ? (
                      <div className="w-9 h-9 flex-shrink-0 overflow-hidden rounded bg-stone-100">
                        <Image src={p.imagenes[0]} alt="" width={36} height={36} className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 flex-shrink-0 rounded bg-stone-100 flex items-center justify-center text-stone-300 text-[8px]">{p.sku}</div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-stone-700 truncate max-w-[160px]">{p.nombre}</p>
                      <p className="text-[10px] text-stone-400 font-mono">{p.sku}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-right font-medium text-stone-700" style={{ fontVariantNumeric: 'tabular-nums' }}>{p.totalSold}</td>
                <td className="px-5 py-3 text-right text-stone-500" style={{ fontVariantNumeric: 'tabular-nums' }}>{p.averageDaily}/día</td>
                <td className={`px-5 py-3 text-right ${getStockColor(p.stock)}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{p.stock}</td>
                <td className={`px-5 py-3 text-right ${getDaysColor(p.daysOfInventory)}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {p.daysOfInventory !== null ? `${p.daysOfInventory}d` : '—'}
                </td>
                <td className="px-5 py-3 text-right font-medium text-wine" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {suggestedOrder > 0 ? `+${suggestedOrder}` : '—'}
                </td>
                <td className="px-5 py-3 text-right text-stone-500" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCOP(p.totalRevenue)}</td>
                <td className="px-5 py-3 text-center">
                  <span className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${urgency.color} ${urgency.bg}`}>
                    <UrgencyIcon size={10} />
                    {urgency.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
