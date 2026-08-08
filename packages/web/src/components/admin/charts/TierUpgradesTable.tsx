'use client';

const TIER_STYLES: Record<string, string> = {
  detal: 'bg-stone-100 text-stone-600',
  por_mayor: 'bg-gold/10 text-gold-dark border border-gold/20',
  gran_mayor: 'bg-wine/10 text-wine border border-wine/20',
};
const TIER_LABELS: Record<string, string> = { detal: 'Detal', por_mayor: 'Por Mayor', gran_mayor: 'Gran Mayor' };

interface Upgrade {
  email: string;
  nombre: string;
  oldTier: string;
  newTier: string;
  createdAt: string;
}

interface Props {
  data: Upgrade[];
  days: number;
}

export default function TierUpgradesTable({ data, days }: Props) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-stone-700 mb-4">Cambios de Tier ({days} días)</h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-stone-400 text-sm">Sin cambios de tier en el periodo</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-stone-400 uppercase tracking-wider border-b border-stone-100">
                <th className="text-left px-3 py-2 font-medium">Cliente</th>
                <th className="text-left px-3 py-2 font-medium">Cambio</th>
                <th className="text-right px-3 py-2 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u, i) => (
                <tr key={`${u.email}-${u.createdAt}`} className={i % 2 === 0 ? 'bg-white' : 'bg-ivory/50'}>
                  <td className="px-3 py-3">
                    <p className="font-medium text-stone-700">{u.nombre}</p>
                    <p className="text-xs text-stone-400">{u.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${TIER_STYLES[u.oldTier] || ''}`}>
                      {TIER_LABELS[u.oldTier] || u.oldTier}
                    </span>
                    <span className="mx-2 text-stone-300">→</span>
                    <span className={`inline-flex items-center text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${TIER_STYLES[u.newTier] || ''}`}>
                      {TIER_LABELS[u.newTier] || u.newTier}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-stone-400 text-xs">{new Date(u.createdAt).toLocaleDateString('es-CO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
