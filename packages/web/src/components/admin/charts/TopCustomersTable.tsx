'use client';

import { formatCOP } from '@/lib/api-client';

const TIER_STYLES: Record<string, string> = {
  detal: 'bg-stone-100 text-stone-600',
  por_mayor: 'bg-gold/10 text-gold-dark border border-gold/20',
  gran_mayor: 'bg-wine/10 text-wine border border-wine/20',
};
const TIER_LABELS: Record<string, string> = { detal: 'Detal', por_mayor: 'Por Mayor', gran_mayor: 'Gran Mayor' };

interface Customer {
  id: string;
  nombre: string;
  email: string;
  tier: string;
  orders: number;
  total: number;
  lastOrderAt: string;
}

interface Props {
  data: Customer[];
  days: number;
}

export default function TopCustomersTable({ data, days }: Props) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-stone-700 mb-4">Top Clientes ({days} días)</h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-stone-400 text-sm">Sin clientes con compras confirmadas en el periodo</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-stone-400 uppercase tracking-wider border-b border-stone-100">
                <th className="text-left px-3 py-2 font-medium">Cliente</th>
                <th className="text-left px-3 py-2 font-medium">Tier</th>
                <th className="text-right px-3 py-2 font-medium">Órdenes</th>
                <th className="text-right px-3 py-2 font-medium">Total</th>
                <th className="text-right px-3 py-2 font-medium">Última compra</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-ivory/50'}>
                  <td className="px-3 py-3">
                    <p className="font-medium text-stone-700">{c.nombre}</p>
                    <p className="text-xs text-stone-400">{c.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${TIER_STYLES[c.tier] || ''}`}>
                      {TIER_LABELS[c.tier] || c.tier}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-stone-600 font-functional" style={{ fontVariantNumeric: 'tabular-nums' }}>{c.orders}</td>
                  <td className="px-3 py-3 text-right font-semibold text-stone-800 font-functional" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCOP(c.total)}</td>
                  <td className="px-3 py-3 text-right text-stone-400 text-xs">{c.lastOrderAt || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
