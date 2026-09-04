'use client';

import Link from 'next/link';
import Image from 'next/image';
import { AlertTriangle, AlertCircle, CheckCircle, Coins, ArrowRight } from 'lucide-react';
import { formatCOP } from '@/lib/api-client';

interface StockItem {
  id: string;
  sku: string;
  nombre: string;
  imagenes: string[];
  stock: number;
  stockMinimo: number;
}

interface Props {
  outOfStock: number;
  lowStock: number;
  totalActiveProducts: number;
  totalUnits: number;
  totalReserved: number;
  inventoryValue?: number;
  outOfStockProducts?: StockItem[];
  lowStockProducts?: StockItem[];
  healthyProducts?: StockItem[];
}

function StockRow({ item }: { item: StockItem }) {
  return (
    <li className="flex items-center gap-2 py-1.5">
      {item.imagenes?.[0] ? (
        <Image src={item.imagenes[0]} alt="" width={24} height={24} className="rounded object-cover flex-shrink-0" />
      ) : (
        <div className="w-6 h-6 rounded bg-stone-200 flex-shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-stone-700 truncate">{item.nombre}</p>
        <p className="text-[9px] text-stone-400 font-functional" style={{ fontVariantNumeric: 'tabular-nums' }}>{item.sku}</p>
      </div>
      <span className="text-[10px] font-semibold text-stone-600 font-functional" style={{ fontVariantNumeric: 'tabular-nums' }}>{item.stock} unid.</span>
    </li>
  );
}

function StockCard({ label, value, count, items, href, icon: Icon, color, bg, listText }: {
  label: string;
  value: string | number;
  count: number;
  items: StockItem[];
  href: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  color: string;
  bg: string;
  listText: string;
}) {
  const extra = Math.max(count - items.length, 0);

  return (
    <div className={`${bg} rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        <Icon size={20} className={`${color} mt-0.5 flex-shrink-0`} />
        <div>
          <p className="text-2xl font-semibold text-stone-800 font-functional" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
          <p className="text-xs text-stone-500">{label}</p>
        </div>
      </div>

      {items.length > 0 ? (
        <ul className="mt-3 border-t border-black/5 pt-1 max-h-40 overflow-y-auto divide-y divide-black/5">
          {items.map((item) => <StockRow key={item.id} item={item} />)}
        </ul>
      ) : (
        <p className="mt-3 border-t border-black/5 pt-3 text-[11px] text-stone-400">{listText}</p>
      )}

      <Link href={href} className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-600 hover:text-wine transition-colors">
        Ver todos
        {extra > 0 && (
          <span className="bg-black/5 text-stone-500 rounded-full px-1.5 py-px font-normal">
            {extra} más
          </span>
        )}
        <ArrowRight size={12} />
      </Link>
    </div>
  );
}

export default function InventoryAlerts({ outOfStock, lowStock, totalActiveProducts, totalUnits, totalReserved, inventoryValue, outOfStockProducts = [], lowStockProducts = [], healthyProducts = [] }: Props) {
  const healthy = totalActiveProducts - outOfStock - lowStock;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
      <StockCard
        label="Sin stock"
        value={outOfStock}
        count={outOfStock}
        items={outOfStockProducts}
        href="/admin/productos?stock=sin_existencias"
        icon={AlertCircle}
        color="text-red-500"
        bg="bg-red-50"
        listText="No hay productos sin stock"
      />
      <StockCard
        label="Stock bajo"
        value={lowStock}
        count={lowStock}
        items={lowStockProducts}
        href="/admin/productos?stock=reabastecer"
        icon={AlertTriangle}
        color="text-yellow-500"
        bg="bg-yellow-50"
        listText="No hay productos en reabastecer"
      />
      <StockCard
        label="En buen estado"
        value={healthy}
        count={healthy}
        items={healthyProducts}
        href="/admin/productos?stock=normal"
        icon={CheckCircle}
        color="text-green-500"
        bg="bg-green-50"
        listText="Sin productos en buen estado"
      />
      <div className="bg-stone-50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Coins size={20} className="text-stone-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-2xl font-semibold text-stone-800 font-functional" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCOP(inventoryValue ?? 0)}</p>
            <p className="text-xs text-stone-500">Valor inventario</p>
            <p className="text-[10px] text-stone-400 mt-0.5">{totalUnits} unidades{totalReserved > 0 ? ` · ${totalReserved} reservadas` : ''}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
