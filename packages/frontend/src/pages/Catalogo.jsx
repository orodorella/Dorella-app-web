import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Filter, ShoppingBag, Plus, Check, ArrowUp, Grid3x3, List, Eye, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { products as productsApi } from '../services/api'
import ProductImage from '../components/ProductImage'
import PriceDisplay from '../components/PriceDisplay'

export default function Catalogo() {
  const { dispatch, showToast, tierInfo } = useApp()
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas')
  const [cantidades, setCantidades] = useState({})
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [agregados, setAgregados] = useState(new Set())
  const [vista, setVista] = useState('grid')
  const [allProducts, setAllProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      productsApi.getAll({ pageSize: 200 }),
      productsApi.getCategories(),
    ]).then(([prodRes, cats]) => {
      setAllProducts(prodRes.data)
      setCategories(cats.map((c) => c.nombre))
    }).catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  const filtrados = allProducts.filter((p) => {
    const matchBusqueda =
      !busqueda ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.ref.toLowerCase().includes(busqueda.toLowerCase())
    const matchCat = categoriaFiltro === 'Todas' || p.categoria === categoriaFiltro
    return matchBusqueda && matchCat
  })

  function setCantidad(id, val) {
    const product = allProducts.find((p) => p.id === id)
    const num = Math.max(0, Math.min(parseInt(val) || 0, product?.stock || 999))
    setCantidades((prev) => ({ ...prev, [id]: num }))
    if (num > 0) setSeleccionados((prev) => new Set(prev).add(id))
  }

  function agregarUno(product) {
    const cant = cantidades[product.id] || 1
    dispatch({ type: 'ADD_TO_CART', payload: [{ product, cantidad: cant }] })
    showToast(`${product.nombre} x${cant} agregado`)
    setCantidades((prev) => ({ ...prev, [product.id]: 0 }))
    setAgregados((prev) => new Set(prev).add(product.id))
    setTimeout(() => setAgregados((prev) => { const n = new Set(prev); n.delete(product.id); return n }), 1500)
  }

  function agregarLote() {
    const items = []
    for (const id of seleccionados) {
      const cant = cantidades[id] || 1
      if (cant <= 0) continue
      const product = allProducts.find((p) => p.id === id)
      if (product) items.push({ product, cantidad: cant })
    }
    if (items.length === 0) return
    dispatch({ type: 'ADD_TO_CART', payload: items })
    const totalPcs = items.reduce((s, i) => s + i.cantidad, 0)
    showToast(`${items.length} referencia(s) — ${totalPcs} piezas agregadas`)
    setCantidades({})
    setSeleccionados(new Set())
    const ids = new Set(items.map((i) => i.product.id))
    setAgregados(ids)
    setTimeout(() => setAgregados(new Set()), 1500)
  }

  function toggleSeleccion(id) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else {
        next.add(id)
        if (!cantidades[id]) setCantidades((c) => ({ ...c, [id]: 1 }))
      }
      return next
    })
  }

  function seleccionarTodos() {
    if (seleccionados.size === filtrados.length) {
      setSeleccionados(new Set())
    } else {
      const all = new Set(filtrados.map((p) => p.id))
      setSeleccionados(all)
      const nuevas = {}
      filtrados.forEach((p) => { if (!cantidades[p.id]) nuevas[p.id] = 1 })
      setCantidades((prev) => ({ ...prev, ...nuevas }))
    }
  }

  const haySeleccionConCantidad = [...seleccionados].some((id) => (cantidades[id] || 0) > 0)

  return (
    <div className="flex-1 bg-white min-h-screen">
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="editorial-title text-[clamp(2rem,5vw,3.2rem)] text-stone-800">
              Catálogo
            </h1>
            <p className="text-[13px] text-stone-400 mt-2 font-light tracking-wide">
              {filtrados.length} referencias
              {tierInfo.descuento > 0 && (
                <span className="ml-2 text-gold">— Precio {tierInfo.label} ({(tierInfo.descuento * 100).toFixed(1)}% dto.)</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Vista toggle */}
            <div className="flex border border-stone-200 overflow-hidden">
              <button
                onClick={() => setVista('grid')}
                className={`p-2.5 cursor-pointer transition-colors ${vista === 'grid' ? 'bg-wine text-white' : 'text-stone-400 hover:text-stone-600'}`}
                aria-label="Vista cuadrícula"
              >
                <Grid3x3 size={16} />
              </button>
              <button
                onClick={() => setVista('list')}
                className={`p-2.5 cursor-pointer transition-colors ${vista === 'list' ? 'bg-wine text-white' : 'text-stone-400 hover:text-stone-600'}`}
                aria-label="Vista mayorista"
              >
                <List size={16} />
              </button>
            </div>

            <AnimatePresence>
              {haySeleccionConCantidad && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={agregarLote}
                  className="flex items-center gap-2 bg-wine text-white px-6 py-2.5 font-semibold text-xs uppercase tracking-[0.12em] cursor-pointer hover:bg-wine-light transition-colors"
                >
                  <ShoppingBag size={14} />
                  Agregar {seleccionados.size} ref.
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o referencia..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-stone-300 focus:ring-1 focus:ring-stone-200 transition-colors"
            />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="pl-10 pr-8 py-3 bg-white border border-stone-200 text-sm text-stone-600 appearance-none cursor-pointer focus:outline-none focus:border-stone-300"
            >
              <option value="Todas">Todas las categorías</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="text-center py-24">
            <Loader2 size={32} className="animate-spin text-wine mx-auto mb-4" />
            <p className="text-stone-400 text-sm">Cargando catálogo...</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-stone-500 text-lg" style={{ fontFamily: 'var(--font-display)' }}>No se encontraron productos</p>
            <p className="text-stone-400 text-sm mt-1">Intenta con otra búsqueda o categoría</p>
          </div>
        ) : vista === 'grid' ? (
          /* ═══ GRID VIEW — Premium ═══ */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10">
            {filtrados.map((p, idx) => {
              const justAdded = agregados.has(p.id)
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.4) }}
                  className={`group relative ${justAdded ? 'ring-2 ring-emerald-300 ring-offset-2' : ''}`}
                >
                  <Link to={`/producto/${p.id}`} className="block cursor-pointer">
                    <div className="aspect-square bg-stone-50 overflow-hidden mb-3 relative">
                      {p.imagen ? (
                        <img src={p.imagen} alt={p.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-50">
                          <span className="text-stone-300 text-sm" style={{ fontFamily: 'var(--font-display)' }}>{p.ref}</span>
                        </div>
                      )}
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100">
                        <span className="bg-white/90 backdrop-blur-sm text-stone-700 text-[10px] uppercase tracking-[0.1em] font-medium px-4 py-2 flex items-center gap-1.5">
                          <Eye size={12} /> Ver detalle
                        </span>
                      </div>
                    </div>
                  </Link>
                  <p className="product-name text-[12px] text-stone-700 uppercase">{p.nombre}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5 font-light tracking-wide">{p.material}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <PriceDisplay precioPublico={p.precioPublico} showUnit={false} />
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => { e.preventDefault(); agregarUno(p) }}
                      className={`p-1.5 cursor-pointer transition-colors ${justAdded ? 'text-emerald-500' : 'text-stone-300 hover:text-wine'}`}
                      aria-label={`Agregar ${p.nombre}`}
                    >
                      {justAdded ? <Check size={16} /> : <Plus size={16} />}
                    </motion.button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : (
          /* ═══ LIST VIEW — Mayorista ═══ */
          <>
            <div className="flex items-center gap-3 mb-4 text-xs text-stone-500">
              <button onClick={seleccionarTodos} className="flex items-center gap-2 hover:text-stone-700 transition-colors cursor-pointer">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  seleccionados.size === filtrados.length && filtrados.length > 0 ? 'bg-wine border-wine text-white' : 'border-stone-300'
                }`}>
                  {seleccionados.size === filtrados.length && filtrados.length > 0 && <Check size={10} />}
                </div>
                Seleccionar todo
              </button>
              {seleccionados.size > 0 && <span className="text-wine font-medium">{seleccionados.size} seleccionados</span>}
            </div>

            <div className="border border-stone-200 overflow-hidden">
              <div className="hidden sm:grid grid-cols-[40px_56px_1fr_110px_80px_80px_80px] gap-4 px-5 py-3 border-b border-stone-200 text-[9px] font-semibold text-stone-400 uppercase tracking-[0.18em] items-center">
                <div></div><div></div><div>Producto</div><div className="text-right">Precio</div><div className="text-center">Stock</div><div className="text-center">Cant.</div><div></div>
              </div>
              {filtrados.map((p, idx) => {
                const isSelected = seleccionados.has(p.id)
                const justAdded = agregados.has(p.id)
                return (
                  <div
                    key={p.id}
                    className={`grid grid-cols-[1fr_auto] sm:grid-cols-[40px_56px_1fr_110px_80px_80px_80px] gap-4 px-5 py-3.5 border-b border-stone-100 items-center transition-colors ${
                      isSelected ? 'bg-wine/[0.03]' : 'hover:bg-stone-50'
                    } ${justAdded ? 'bg-emerald-50' : ''}`}
                  >
                    <div className="hidden sm:flex">
                      <button onClick={() => toggleSeleccion(p.id)} className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-all ${isSelected ? 'bg-wine border-wine text-white' : 'border-stone-300 hover:border-stone-400'}`} aria-label={`Seleccionar ${p.nombre}`}>
                        {isSelected && <Check size={11} />}
                      </button>
                    </div>
                    <div className="hidden sm:block"><ProductImage product={p} size="sm" /></div>
                    <div className="min-w-0">
                      <Link to={`/producto/${p.id}`} className="text-[13px] font-semibold text-stone-800 truncate block hover:text-wine transition-colors cursor-pointer tracking-wide">{p.nombre}</Link>
                      <p className="font-functional text-[10px] text-stone-400 tracking-wider">{p.ref} · {p.categoria}</p>
                    </div>
                    <div className="text-right"><PriceDisplay precioPublico={p.precioPublico} /></div>
                    <div className="hidden sm:block text-center">
                      <span className={`text-[11px] font-medium ${p.stock > 50 ? 'text-emerald-600' : p.stock > 10 ? 'text-amber-600' : 'text-red-600'}`}>{p.stock} uds</span>
                    </div>
                    <div className="hidden sm:flex justify-center">
                      <input type="number" min="0" max={p.stock} value={cantidades[p.id] || ''} onChange={(e) => setCantidad(p.id, e.target.value)} onFocus={() => { if (!cantidades[p.id]) setCantidad(p.id, 1) }} placeholder="0" className="w-16 text-center py-1.5 bg-white border border-stone-200 text-sm focus:outline-none focus:border-stone-300" style={{ fontVariantNumeric: 'tabular-nums' }} />
                    </div>
                    <div className="hidden sm:flex justify-center">
                      {justAdded ? (
                        <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium"><Check size={14} /> Listo</span>
                      ) : (
                        <button onClick={() => agregarUno(p)} className="text-xs text-wine/40 hover:text-wine cursor-pointer px-2 py-1.5 hover:bg-wine/5 transition-colors"><Plus size={14} /></button>
                      )}
                    </div>
                    <div className="sm:hidden flex items-center gap-2">
                      <input type="number" min="0" max={p.stock} value={cantidades[p.id] || ''} onChange={(e) => setCantidad(p.id, e.target.value)} placeholder="0" className="w-14 text-center py-1.5 bg-white border border-stone-200 text-sm" />
                      <button onClick={() => agregarUno(p)} className="bg-wine text-white p-2.5 cursor-pointer" aria-label={`Agregar ${p.nombre}`}>
                        {justAdded ? <Check size={14} /> : <Plus size={14} />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Floating batch bar */}
        <AnimatePresence>
          {haySeleccionConCantidad && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30">
              <button onClick={agregarLote} className="flex items-center gap-3 bg-wine text-white px-10 py-4 rounded-full shadow-xl font-semibold text-sm uppercase tracking-[0.1em] cursor-pointer hover:bg-wine-light transition-colors">
                <ShoppingBag size={18} /> Agregar {seleccionados.size} ref. al carrito <ArrowUp size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
