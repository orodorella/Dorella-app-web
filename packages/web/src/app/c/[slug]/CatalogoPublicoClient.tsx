'use client';

import Image from 'next/image';
import { Printer } from 'lucide-react';

interface CatalogoData {
  id: string;
  nombre: string;
  configuracion: { negocio?: string; logo_url?: string | null; color_principal?: string; mostrar_precios?: boolean };
  productos: Array<{ id: string; nombre: string; descripcion: string | null; imagen: string | null; material: string | null; precio: number | null }>;
}

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

export default function CatalogoPublicoClient({ catalogo }: { catalogo: CatalogoData }) {
  const config = catalogo.configuracion || {};
  const color = config.color_principal || '#1A1A1A';

  return (
    <>
      <style>{`@media print { .no-print { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>
      <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
        <header className="py-8 sm:py-12 text-center" style={{ backgroundColor: color }}>
          {config.logo_url ? <img src={config.logo_url} alt={config.negocio} className="h-16 mx-auto mb-3 object-contain" />
          : <h1 className="text-3xl sm:text-4xl text-white" style={{ fontFamily: "'Playfair Display', serif" }}>{config.negocio}</h1>}
        </header>

        <div className="no-print max-w-[1000px] mx-auto px-6 pt-6 flex justify-end">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 border border-stone-200 rounded text-xs text-stone-500 hover:text-stone-700 hover:border-stone-400 cursor-pointer transition-colors">
            <Printer size={14} /> Imprimir / PDF
          </button>
        </div>

        <main className="max-w-[1000px] mx-auto px-6 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {catalogo.productos.map((p) => (
              <div key={p.id} className="text-center">
                {p.imagen ? <div className="relative aspect-square bg-stone-50 overflow-hidden mb-4"><Image src={p.imagen} alt={p.nombre} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover" /></div>
                : <div className="aspect-square bg-stone-50 flex items-center justify-center mb-4"><span className="text-stone-300 text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>Sin imagen</span></div>}
                <h3 className="text-sm text-stone-700 uppercase tracking-wide font-medium">{p.nombre}</h3>
                {p.material && <p className="text-xs text-stone-400 mt-1">{p.material}</p>}
                {p.precio ? <p className="text-lg font-semibold mt-2" style={{ color }}>{fmtCOP(p.precio)}</p>
                : config.mostrar_precios ? <p className="text-sm text-stone-300 italic mt-2">Consultar precio</p> : null}
              </div>
            ))}
          </div>
        </main>

        <footer className="py-8 text-center border-t border-stone-100">
          <p className="text-[10px] text-stone-300 tracking-widest uppercase">Catálogo generado con ♥</p>
        </footer>
      </div>
    </>
  );
}
