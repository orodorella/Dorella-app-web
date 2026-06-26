import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Printer, FileText } from 'lucide-react'
import { catalogos } from '../services/api'

export default function CatalogoPublico() {
  const { slug } = useParams()
  const [catalogo, setCatalogo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    catalogos.getPublico(slug)
      .then((data) => {
        if (!data) setNotFound(true)
        else setCatalogo(data)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 size={32} className="animate-spin text-stone-400" />
      </div>
    )
  }

  if (notFound || !catalogo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center px-6">
          <FileText size={48} className="text-stone-200 mx-auto mb-4" />
          <h1 className="text-2xl text-stone-700 mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Catálogo no disponible</h1>
          <p className="text-sm text-stone-400">Este catálogo no existe o ya no está activo</p>
        </div>
      </div>
    )
  }

  const config = catalogo.configuracion || {}
  const color = config.color_principal || '#1A1A1A'
  const formatCOP = (n) => '$' + Math.round(n).toLocaleString('es-CO')

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* Header */}
        <header className="py-8 sm:py-12 text-center" style={{ backgroundColor: color }}>
          {config.logo_url ? (
            <img src={config.logo_url} alt={config.negocio} className="h-16 mx-auto mb-3 object-contain" />
          ) : (
            <h1 className="text-3xl sm:text-4xl text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
              {config.negocio}
            </h1>
          )}
        </header>

        {/* Print button */}
        <div className="no-print max-w-[1000px] mx-auto px-6 pt-6 flex justify-end">
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 border border-stone-200 rounded text-xs text-stone-500 hover:text-stone-700 hover:border-stone-400 cursor-pointer transition-colors">
            <Printer size={14} /> Imprimir / Guardar PDF
          </button>
        </div>

        {/* Products grid */}
        <main className="max-w-[1000px] mx-auto px-6 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {catalogo.productos.map((p) => (
              <div key={p.id} className="text-center">
                {p.imagen ? (
                  <div className="aspect-square bg-stone-50 overflow-hidden mb-4">
                    <img src={p.imagen} alt={p.nombre} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-square bg-stone-50 flex items-center justify-center mb-4">
                    <span className="text-stone-300 text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>Sin imagen</span>
                  </div>
                )}
                <h3 className="text-sm text-stone-700 uppercase tracking-wide font-medium">{p.nombre}</h3>
                {p.material && <p className="text-xs text-stone-400 mt-1">{p.material}</p>}
                {p.precio ? (
                  <p className="text-lg font-semibold mt-2" style={{ color }}>{formatCOP(p.precio)}</p>
                ) : config.mostrar_precios ? (
                  <p className="text-sm text-stone-300 italic mt-2">Consultar precio</p>
                ) : null}
              </div>
            ))}
          </div>
        </main>

        {/* Footer */}
        <footer className="py-8 text-center border-t border-stone-100">
          <p className="text-[10px] text-stone-300 tracking-widest uppercase">
            Catálogo generado con ♥
          </p>
        </footer>
      </div>
    </>
  )
}
