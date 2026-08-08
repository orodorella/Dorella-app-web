'use client';

interface SlowMover {
  productId: string;
  sku: string;
  nombre: string;
  stock: number;
  stockMinimo: number;
  category: string;
}

interface Props {
  data: SlowMover[];
}

export default function SlowMoversTable({ data }: Props) {
  if (data.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] text-stone-400 uppercase tracking-wider border-b border-stone-100">
            <th className="text-left px-3 py-2 font-medium">Producto</th>
            <th className="text-left px-3 py-2 font-medium">SKU</th>
            <th className="text-left px-3 py-2 font-medium">Categoría</th>
            <th className="text-right px-3 py-2 font-medium">Stock</th>
            <th className="text-right px-3 py-2 font-medium">Stock mín.</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p, i) => (
            <tr key={p.productId} className={i % 2 === 0 ? 'bg-white' : 'bg-ivory/50'}>
              <td className="px-3 py-3 font-medium text-stone-700">{p.nombre}</td>
              <td className="px-3 py-3 text-stone-500 font-functional" style={{ fontVariantNumeric: 'tabular-nums' }}>{p.sku}</td>
              <td className="px-3 py-3 text-stone-500">{p.category}</td>
              <td className="px-3 py-3 text-right text-stone-600 font-functional" style={{ fontVariantNumeric: 'tabular-nums' }}>{p.stock}</td>
              <td className="px-3 py-3 text-right text-stone-400 font-functional" style={{ fontVariantNumeric: 'tabular-nums' }}>{p.stockMinimo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
