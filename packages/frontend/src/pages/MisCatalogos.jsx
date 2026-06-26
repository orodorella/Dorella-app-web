import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, FileText, Eye, Trash2, Link2, Copy, ToggleLeft, ToggleRight, Loader2, X, Search, Check, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { catalogos, products as productsApi } from '../services/api'
import { formatCOP } from '../components/PriceDisplay'

export default function MisCatalogos() {
  const { showToast } = useApp()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [step, setStep] = useState(1)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ nombre: '', negocio: '', logo_url: '', color_principal: '#1A1A1A', mostrar_precios: false })
  const [allProducts, setAllProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedProducts, setSelectedProducts] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('Todas')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadCatalogos() }, [])

  function loadCatalogos() {
    setLoading(true)
    catalogos.getAll().then(setList).catch((e) => showToast(e.message, 'error')).finally(() => setLoading(false))
  }

  function openCreate() {
    setEditingId(null)
    setForm({ nombre: '', negocio: '', logo_url: '', color_principal: '#1A1A1A', mostrar_precios: false })
    setSelectedProducts([])
    setStep(1)
    setShowModal(true)
    loadProductsAndCategories()
  }

  async function openEdit(cat) {
    setEditingId(cat.id)
    const config = cat.configuracion || {}
    setForm({ nombre: cat.nombre, negocio: config.negocio || '', logo_url: config.logo_url || '', color_principal: config.color_principal || '#1A1A1A', mostrar_precios: config.mostrar_precios || false })
    setStep(1)
    setShowModal(true)
    loadProductsAndCategories()
    try {
      const detail = await catalogos.getById(cat.id)
      setSelectedProducts(detail.productos.map((p) => ({ productId: p.product.id, nombre: p.product.nombre, precioPersonalizado: p.precioPersonalizado })))
    } catch {}
  }

  function loadProductsAndCategories() {
    Promise.all([
      productsApi.getAll({ pageSize: 200 }),
      productsApi.getCategories(),
    ]).then(([p, c]) => {
      setAllProducts(p.data)
      setCategories(c.map((cat) => cat.nombre))
    }).catch(() => {})
  }

  function toggleProduct(product) {
    setSelectedProducts((prev) => {
      const exists = prev.find((p) => p.productId === product.id)
      if (exists) return prev.filter((p) => p.productId !== product.id)
      return [...prev, { productId: product.id, nombre: product.nombre, precioPersonalizado: null }]
    })
  }

  function setPrecio(productId, precio) {
    setSelectedProducts((prev) => prev.map((p) => p.productId === productId ? { ...p, precioPersonalizado: precio ? Number(precio) : null } : p))
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editingId) {
        await catalogos.update(editingId, { nombre: form.nombre, configuracion: { negocio: form.negocio, logo_url: form.logo_url || null, color_principal: form.color_principal, mostrar_precios: form.mostrar_precios } })
        if (selectedProducts.length > 0) {
          await catalogos.addProductos(editingId, selectedProducts.map((p) => ({ productId: p.productId, precioPersonalizado: p.precioPersonalizado })))
        }
        showToast('Catálogo actualizado')
      } else {
        const created = await catalogos.create({ nombre: form.nombre, configuracion: { negocio: form.negocio, logo_url: form.logo_url || null, color_principal: form.color_principal, mostrar_precios: form.mostrar_precios } })
        if (selectedProducts.length > 0) {
          await catalogos.addProductos(created.id, selectedProducts.map((p) => ({ productId: p.productId, precioPersonalizado: p.precioPersonalizado })))
        }
        showToast('Catálogo creado')
      }
      setShowModal(false)
      loadCatalogos()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este catálogo?')) return
    try {
      await catalogos.remove(id)
      showToast('Catálogo eliminado')
      loadCatalogos()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function handleToggle(id) {
    try {
      const result = await catalogos.toggle(id)
      showToast(result.activo ? 'Catálogo activado' : 'Catálogo desactivado')
      loadCatalogos()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  function copyLink(slug) {
    navigator.clipboard.writeText(`${window.location.origin}/c/${slug}`)
    showToast('Link copiado al portapapeles')
  }

  const filteredProducts = allProducts.filter((p) => {
    const matchSearch = !search || p.nombre.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'Todas' || p.categoria === catFilter
    return matchSearch && matchCat
  })

  return (
    <div className="flex-1 bg-white min-h-screen">
      <div className="max-w-[1000px] mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl sm:text-4xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Mis Catálogos</h1>
            <p className="text-sm text-stone-400 font-light mt-1">Catálogos sin marca para compartir con tus clientes</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 bg-wine text-white px-6 py-3 text-[11px] tracking-[0.1em] uppercase font-medium cursor-pointer hover:bg-wine-light transition-colors">
            <Plus size={14} /> Nuevo Catálogo
          </button>
        </motion.div>

        {loading ? (
          <div className="text-center py-24"><Loader2 size={32} className="animate-spin text-wine mx-auto" /></div>
        ) : list.length === 0 ? (
          <div className="border border-stone-200 rounded-lg p-16 text-center">
            <FileText size={48} className="text-stone-200 mx-auto mb-5" />
            <p className="text-xl text-stone-700 mb-2" style={{ fontFamily: 'var(--font-display)' }}>Aún no tenés catálogos</p>
            <p className="text-sm text-stone-400 font-light mb-8 max-w-sm mx-auto">Creá tu primer catálogo sin marca y compartilo con tus clientes</p>
            <button onClick={openCreate} className="inline-flex items-center gap-2 bg-wine text-white px-8 py-3 text-[11px] tracking-[0.12em] uppercase font-medium cursor-pointer hover:bg-wine-light transition-colors">
              <Plus size={14} /> Crear mi primer catálogo
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {list.map((cat, i) => {
              const config = cat.configuracion || {}
              return (
                <motion.div key={cat.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="border border-stone-200 rounded-lg overflow-hidden hover:border-stone-300 transition-colors">
                  <div className="h-2" style={{ background: config.color_principal || '#1A1A1A' }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-stone-800">{cat.nombre}</h3>
                        <p className="text-xs text-stone-400 mt-0.5">{config.negocio || '—'}</p>
                      </div>
                      <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${cat.activo ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-400'}`}>
                        {cat.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mb-4">{cat._count?.productos || 0} productos · {new Date(cat.createdAt).toLocaleDateString('es-CO')}</p>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openEdit(cat)} className="flex-1 text-center py-2 text-xs text-wine border border-stone-200 rounded hover:border-wine/20 hover:bg-wine/5 cursor-pointer transition-colors">Editar</button>
                      <button onClick={() => copyLink(cat.slug)} className="p-2 text-stone-400 hover:text-wine cursor-pointer transition-colors" title="Copiar link"><Copy size={14} /></button>
                      <a href={`/c/${cat.slug}`} target="_blank" rel="noopener noreferrer" className="p-2 text-stone-400 hover:text-wine cursor-pointer transition-colors" title="Ver catálogo"><Eye size={14} /></a>
                      <button onClick={() => handleToggle(cat.id)} className="p-2 text-stone-400 hover:text-wine cursor-pointer transition-colors" title={cat.activo ? 'Desactivar' : 'Activar'}>
                        {cat.activo ? <ToggleRight size={14} className="text-emerald-500" /> : <ToggleLeft size={14} />}
                      </button>
                      <button onClick={() => handleDelete(cat.id)} className="p-2 text-stone-400 hover:text-red-500 cursor-pointer transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 cursor-pointer z-10"><X size={18} /></button>

              <div className="p-6">
                <h2 className="text-xl font-semibold text-stone-800 mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                  {editingId ? 'Editar Catálogo' : 'Nuevo Catálogo'}
                </h2>
                <div className="flex items-center gap-2 mb-6">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${step === 1 ? 'bg-wine text-white' : 'bg-stone-100 text-stone-400'}`}>1. Info</span>
                  <ChevronRight size={12} className="text-stone-300" />
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${step === 2 ? 'bg-wine text-white' : 'bg-stone-100 text-stone-400'}`}>2. Productos</span>
                </div>

                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">Nombre del catálogo</label>
                      <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Colección Aretes 2024"
                        className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-wine/30" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">Nombre de tu negocio</label>
                      <input value={form.negocio} onChange={(e) => setForm({ ...form, negocio: e.target.value })} placeholder="Ej: Joyas María"
                        className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-wine/30" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">Logo (URL)</label>
                      <input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..."
                        className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-wine/30" />
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">Color principal</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={form.color_principal} onChange={(e) => setForm({ ...form, color_principal: e.target.value })} className="w-10 h-10 rounded border border-stone-200 cursor-pointer" />
                          <span className="text-xs text-stone-400 font-mono">{form.color_principal}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">Mostrar precios</label>
                        <button type="button" onClick={() => setForm({ ...form, mostrar_precios: !form.mostrar_precios })}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${form.mostrar_precios ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-stone-200 text-stone-500'}`}>
                          {form.mostrar_precios ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          <span className="text-sm">{form.mostrar_precios ? 'Sí' : 'No'}</span>
                        </button>
                      </div>
                    </div>
                    <button onClick={() => setStep(2)} disabled={!form.nombre || !form.negocio}
                      className="w-full bg-wine text-white py-3 rounded-lg text-sm font-semibold uppercase tracking-wider cursor-pointer hover:bg-wine-light transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                      Siguiente <ChevronRight size={14} />
                    </button>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <div className="flex gap-3 mb-4">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-300" />
                      </div>
                      <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
                        className="px-3 py-2 border border-stone-200 rounded-lg text-sm cursor-pointer focus:outline-none">
                        <option value="Todas">Todas</option>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    {selectedProducts.length > 0 && (
                      <div className="bg-ivory rounded-lg p-3 mb-4">
                        <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold mb-2">{selectedProducts.length} seleccionados</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedProducts.map((sp) => (
                            <span key={sp.productId} className="inline-flex items-center gap-1 text-[10px] bg-white border border-stone-200 px-2 py-1 rounded">
                              {sp.nombre}
                              <button onClick={() => setSelectedProducts((prev) => prev.filter((p) => p.productId !== sp.productId))} className="text-stone-400 hover:text-red-500 cursor-pointer"><X size={10} /></button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="max-h-[40vh] overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100">
                      {filteredProducts.map((p) => {
                        const isSelected = selectedProducts.some((sp) => sp.productId === p.id)
                        const sp = selectedProducts.find((sp) => sp.productId === p.id)
                        return (
                          <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${isSelected ? 'bg-wine/[0.03]' : 'hover:bg-stone-50'} transition-colors`}>
                            <button onClick={() => toggleProduct(p)} className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer flex-shrink-0 ${isSelected ? 'bg-wine border-wine text-white' : 'border-stone-300'}`}>
                              {isSelected && <Check size={12} />}
                            </button>
                            {p.imagen ? <img src={p.imagen} alt="" className="w-10 h-10 rounded object-cover bg-stone-100 flex-shrink-0" /> : <div className="w-10 h-10 rounded bg-stone-100 flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-stone-700 truncate">{p.nombre}</p>
                              <p className="text-[10px] text-stone-400">{p.ref} · {p.categoria}</p>
                            </div>
                            {isSelected && form.mostrar_precios && (
                              <input type="number" min="0" placeholder="Precio" value={sp?.precioPersonalizado || ''} onChange={(e) => setPrecio(p.id, e.target.value)}
                                className="w-24 text-right py-1 px-2 border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-300" style={{ fontVariantNumeric: 'tabular-nums' }} />
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex gap-3 mt-4">
                      <button onClick={() => setStep(1)} className="flex-1 py-3 border border-stone-200 rounded-lg text-sm text-stone-600 cursor-pointer hover:bg-stone-50 transition-colors">← Atrás</button>
                      <button onClick={handleSave} disabled={saving}
                        className="flex-1 bg-wine text-white py-3 rounded-lg text-sm font-semibold uppercase tracking-wider cursor-pointer hover:bg-wine-light transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                        {saving && <Loader2 size={14} className="animate-spin" />}
                        {editingId ? 'Guardar' : 'Crear Catálogo'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
