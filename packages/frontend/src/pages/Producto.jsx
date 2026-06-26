import { useState, useEffect } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Minus, Plus, ChevronDown, MessageCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { products as productsApi } from '../services/api'
import PriceDisplay, { formatCOP } from '../components/PriceDisplay'
import ProductImage from '../components/ProductImage'

export default function Producto() {
  const { id } = useParams()
  const { dispatch, showToast, tierInfo } = useApp()
  const [cantidad, setCantidad] = useState(1)
  const [openSection, setOpenSection] = useState(null)
  const [product, setProduct] = useState(null)
  const [relacionados, setRelacionados] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    productsApi.getById(id).then((p) => {
      setProduct(p)
      productsApi.getAll({ categoria: p.categoriaSlug, pageSize: 5 }).then((res) => {
        setRelacionados(res.data.filter((r) => r.id !== p.id && r.imagen).slice(0, 4))
      }).catch(() => {})
    }).catch(() => setProduct(null))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex-1 bg-white min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-wine" />
      </div>
    )
  }

  if (!product) return <Navigate to="/catalogo" replace />

  function addToCart() {
    dispatch({ type: 'ADD_TO_CART', payload: [{ product, cantidad }] })
    showToast(`${product.nombre} x${cantidad} agregado al carrito`)
  }

  const whatsappMsg = encodeURIComponent(`Hola, me interesa: ${product.nombre} (${product.ref}) - ${formatCOP(product.precio)}`)

  const accordions = [
    { key: 'garantia', title: 'Garantía', content: 'Todas nuestras piezas cuentan con garantía por cambio de tonalidad. Si el color de tu joya cambia, la reemplazamos sin costo adicional. La garantía cubre uso normal y no aplica para daños por productos químicos o golpes.' },
    { key: 'envio', title: 'Envío', content: 'Envíos a toda Colombia por TCC o Servientrega. Tiempo estimado: 3-5 días hábiles. Empaque discreto y seguro. Pedidos superiores a $500.000 con envío gratuito.' },
    { key: 'cuidados', title: 'Cuidados del producto', content: 'Evitar contacto con perfumes, cremas y productos químicos. Guardar en lugar seco y separado de otras joyas. Limpiar con paño suave y seco. Retirar antes de bañarse o hacer ejercicio.' },
  ]

  return (
    <div className="flex-1 bg-white min-h-screen">
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <Link to="/catalogo" className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-stone-600 transition-colors cursor-pointer mb-8">
          <ArrowLeft size={16} /> Catálogo
        </Link>

        {/* Product layout */}
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-16">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {product.imagen ? (
              <div className="aspect-square bg-stone-50 overflow-hidden">
                <img src={product.imagen} alt={product.nombre} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-square bg-gradient-to-br from-stone-100 to-stone-50 flex items-center justify-center">
                <span className="text-stone-300 text-lg" style={{ fontFamily: 'var(--font-display)' }}>
                  {product.ref}
                </span>
              </div>
            )}
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <p className="font-functional text-[10px] text-stone-400 uppercase tracking-[0.2em] mb-2">{product.ref}</p>
            <h1 className="text-3xl sm:text-4xl text-stone-800 mb-3" style={{ fontFamily: 'var(--font-display)' }}>
              {product.nombre}
            </h1>
            <p className="text-xs text-stone-400 uppercase tracking-[0.15em] mb-6">{product.material}</p>

            {/* Price */}
            <div className="mb-8 pb-8 border-b border-stone-100">
              <div className="flex items-baseline gap-3" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <span className="text-2xl font-semibold text-wine" style={{ fontFamily: 'var(--font-display)' }}>
                  {formatCOP(product.precio)}
                </span>
                {tierInfo.descuento > 0 && (
                  <span className="text-xs text-wine/50">-{(tierInfo.descuento * 100).toFixed(1)}%</span>
                )}
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-stone-500 leading-relaxed font-light mb-8">{product.descripcion}</p>

            {/* Quantity + Add */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center border border-stone-200">
                <button
                  onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                  className="w-10 h-10 flex items-center justify-center hover:bg-stone-50 cursor-pointer transition-colors"
                  aria-label="Disminuir"
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  min="1"
                  max={product.stock}
                  value={cantidad}
                  onChange={(e) => setCantidad(Math.max(1, Math.min(parseInt(e.target.value) || 1, product.stock)))}
                  className="w-14 h-10 text-center text-sm border-x border-stone-200 focus:outline-none"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                />
                <button
                  onClick={() => setCantidad(Math.min(product.stock, cantidad + 1))}
                  className="w-10 h-10 flex items-center justify-center hover:bg-stone-50 cursor-pointer transition-colors"
                  aria-label="Aumentar"
                >
                  <Plus size={14} />
                </button>
              </div>
              <span className="text-xs text-stone-400">{product.stock} disponibles</span>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={addToCart}
              className="w-full bg-wine text-white py-4 font-semibold text-[11px] uppercase tracking-[0.2em] hover:bg-wine-light cursor-pointer flex items-center justify-center gap-2 transition-colors mb-3"
            >
              <ShoppingBag size={16} />
              Agregar al carrito
            </motion.button>

            <a
              href={`https://wa.me/573000000000?text=${whatsappMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full border border-stone-200 text-stone-600 py-3.5 font-medium text-[11px] uppercase tracking-[0.15em] hover:border-stone-400 cursor-pointer flex items-center justify-center gap-2 transition-colors"
            >
              <MessageCircle size={16} />
              Comprar por WhatsApp
            </a>

            {/* Accordions */}
            <div className="mt-10 border-t border-stone-100">
              {accordions.map((a) => (
                <div key={a.key} className="border-b border-stone-100">
                  <button
                    onClick={() => setOpenSection(openSection === a.key ? null : a.key)}
                    className="w-full flex items-center justify-between py-4 text-sm text-stone-700 cursor-pointer hover:text-stone-900 transition-colors"
                  >
                    <span className="uppercase tracking-[0.1em] text-[11px] font-medium">{a.title}</span>
                    <ChevronDown size={16} className={`text-stone-400 transition-transform duration-300 ${openSection === a.key ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {openSection === a.key && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <p className="text-sm text-stone-400 font-light leading-relaxed pb-4">{a.content}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Related */}
        {relacionados.length > 0 && (
          <section className="mt-24 mb-8">
            <h2 className="text-2xl text-stone-800 mb-10 text-center" style={{ fontFamily: 'var(--font-display)' }}>
              También te puede interesar
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {relacionados.map((p) => (
                <Link key={p.id} to={`/producto/${p.id}`} className="group cursor-pointer block">
                  <div className="aspect-square bg-stone-50 overflow-hidden mb-3">
                    <img src={p.imagen} alt={p.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <p className="text-[11px] text-stone-700 uppercase tracking-[0.05em] group-hover:text-wine transition-colors">{p.nombre}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{p.material}</p>
                  <div className="mt-1">
                    <PriceDisplay precioPublico={p.precioPublico} showUnit={false} />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
