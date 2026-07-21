'use client';

import { AlertTriangle, AlertCircle, CheckCircle, Package } from 'lucide-react';

interface Props {
  outOfStock: number;
  lowStock: number;
  totalActiveProducts: number;
  totalUnits: number;
  totalReserved: number;
}

export default function InventoryAlerts({ outOfStock, lowStock, totalActiveProducts, totalUnits, totalReserved }: Props) {
  const healthy = totalActiveProducts - outOfStock - lowStock;

  const cards = [
    { label: 'Sin stock', value: outOfStock, icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Stock bajo', value: lowStock, icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    { label: 'En buen estado', value: healthy, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Total unidades', value: totalUnits, icon: Package, color: 'text-stone-500', bg: 'bg-stone-50', sub: totalReserved > 0 ? `${totalReserved} reservadas` : undefined },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className={`${c.bg} rounded-lg p-4 flex items-start gap-3`}>
          <c.icon size={20} className={`${c.color} mt-0.5 flex-shrink-0`} />
          <div>
            <p className="text-2xl font-semibold text-stone-800 font-functional">{c.value}</p>
            <p className="text-xs text-stone-500">{c.label}</p>
            {c.sub && <p className="text-[10px] text-stone-400 mt-0.5">{c.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
