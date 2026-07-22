'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FileText, Eye, Trash2, Copy, ToggleLeft, ToggleRight, Loader2, X, Search, Check, ChevronRight } from 'lucide-react';
import { useToast } from '@/context/ToastProvider';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import Image from 'next/image';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface CatalogoItem { id: string; nombre: string; slug: string; activo: boolean; configuracion: Record<string, unknown>; createdAt: string; _count?: { productos: number }; }
interface MappedProduct { id: string; ref: string; nombre: string; precio: number; imagen: string | null; material: string; stock: number; categoria: string; }

export default function MisCatalogosPage() {
  const { showToast } = useToast();
  const [list, setList] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', negocio: '', logo_url: '', color_principal: '#1A1A1A', mostrar_precios: false });
  const [allProducts, setAllProducts] = useState<MappedProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Array<{ productId: string; nombre: string; precioPersonalizado: number | null }>>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('Todas');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => { loadCatalogos(); }, []);

  function loadCatalogos() {
    setLoading(true);
    request('GET', '/api/catalogos').then((res) => { if (res.success) setList(res.data); }).catch((e: Error) => showToast(e.message, 'error')).finally(() => setLoading(false));
  }

  function loadProductsAndCategories() {
    Promise.all([
      request('GET', '/api/products?pageSize=200'),
      request('GET', '/api/categories'),
    ]).then(([p, c]) => {
      if (p.success) setAllProducts(p.data.map((prod: { id: string; sku: string; nombre: string; precio: number; imagenes: string[]; material: string; stock: number; categoria: { nombre: string } }) => ({ id: prod.id, ref: prod.sku, nombre: prod.nombre, precio: prod.precio, imagen: prod.imagenes?.[0] || null, material: prod.material, stock: prod.stock, categoria: prod.categoria?.nombre || '' })));
      if (c.success) setCategories(c.data.map((cat: { nombre: string }) => cat.nombre));
    });
  }

  function openCreate() { setEditingId(null); setForm({ nombre: '', negocio: '', logo_url: '', color_principal: '#1A1A1A', mostrar_precios: false }); setSelectedProducts([]); setStep(1); setShowModal(true); loadProductsAndCategories(); }

  async function openEdit(cat: CatalogoItem) {
    setEditingId(cat.id); const cfg = cat.configuracion || {};
    setForm({ nombre: cat.nombre, negocio: (cfg.negocio as string) || '', logo_url: (cfg.logo_url as string) || '', color_principal: (cfg.color_principal as string) || '#1A1A1A', mostrar_precios: (cfg.mostrar_precios as boolean) || false });
    setStep(1); setShowModal(true); loadProductsAndCategories();
    try { const res = await request('GET', `/api/catalogos/${cat.id}`); if (res.success) setSelectedProducts(res.data.productos.map((p: { product: { id: string; nombre: string }; precioPersonalizado: number | null }) => ({ productId: p.product.id, nombre: p.product.nombre, precioPersonalizado: p.precioPersonalizado }))); } catch {}
  }

  function toggleProduct(product: MappedProduct) {
    setSelectedProducts((prev) => prev.find((p) => p.productId === product.id) ? prev.filter((p) => p.productId !== product.id) : [...prev, { productId: product.id, nombre: product.nombre, precioPersonalizado: null }]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const cfg = { negocio: form.negocio, logo_url: form.logo_url || null, color_principal: form.color_principal, mostrar_precios: form.mostrar_precios };
      if (editingId) { await request('PUT', `/api/catalogos/${editingId}`, { nombre: form.nombre, configuracion: cfg }); if (selectedProducts.length > 0) await request('POST', `/api/catalogos/${editingId}/productos`, { productos: selectedProducts.map((p) => ({ productId: p.productId, precioPersonalizado: p.precioPersonalizado })) }); showToast('Catálogo actualizado'); }
      else { const res = await request('POST', '/api/catalogos', { nombre: form.nombre, configuracion: cfg }); if (res.success && selectedProducts.length > 0) await request('POST', `/api/catalogos/${res.data.id}/productos`, { productos: selectedProducts.map((p) => ({ productId: p.productId, precioPersonalizado: p.precioPersonalizado })) }); showToast('Catálogo creado'); }
      setShowModal(false); loadCatalogos();
    } catch (e) { showToast((e as Error).message, 'error'); } finally { setSaving(false); }
  }

  async function handleDelete(id: string) { setConfirmDeleteId(id); }
  async function confirmDeleteCatalogo() {
    if (!confirmDeleteId) return;
    try { await request('DELETE', `/api/catalogos/${confirmDeleteId}`); showToast('Eliminado'); loadCatalogos(); } catch (e) { showToast((e as Error).message, 'error'); }
    finally { setConfirmDeleteId(null); }
  }
  async function handleToggle(id: string) { try { const res = await request('POST', `/api/catalogos/${id}/toggle`); showToast(res.data?.activo ? 'Activado' : 'Desactivado'); loadCatalogos(); } catch (e) { showToast((e as Error).message, 'error'); } }
  function copyLink(slug: string) { navigator.clipboard.writeText(`${window.location.origin}/c/${slug}`); showToast('Link copiado'); }

  const filtered = allProducts.filter((p) => { const m = !search || p.nombre.toLowerCase().includes(search.toLowerCase()); const c = catFilter === 'Todas' || p.categoria === catFilter; return m && c; });

  return (
    <div className="flex-1 bg-white min-h-screen">
      <div className="max-w-[1000px] mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-10">
          <div><h1 className="text-3xl sm:text-4xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Mis Catálogos</h1><p className="text-sm text-stone-400 font-light mt-1">Catálogos sin marca para compartir</p></div>
          <button onClick={openCreate} className="flex items-center gap-2 bg-wine text-white px-6 py-3 text-[11px] tracking-[0.1em] uppercase font-medium cursor-pointer hover:bg-wine-light transition-colors"><Plus size={14} /> Nuevo</button>
        </motion.div>

        {loading ? <div className="text-center py-24"><Loader2 size={32} className="animate-spin text-wine mx-auto" /></div>
        : list.length === 0 ? (
          <div className="border border-stone-200 rounded-lg p-16 text-center">
            <FileText size={48} className="text-stone-200 mx-auto mb-5" /><p className="text-xl text-stone-700 mb-2" style={{ fontFamily: 'var(--font-display)' }}>Aún no tenés catálogos</p>
            <button onClick={openCreate} className="inline-flex items-center gap-2 bg-wine text-white px-8 py-3 text-[11px] tracking-[0.12em] uppercase font-medium cursor-pointer hover:bg-wine-light transition-colors mt-6"><Plus size={14} /> Crear</button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {list.map((cat, i) => { const cfg = cat.configuracion || {}; return (
              <motion.div key={cat.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="border border-stone-200 rounded-lg overflow-hidden hover:border-stone-300 transition-colors">
                <div className="h-2" style={{ background: (cfg.color_principal as string) || '#1A1A1A' }} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3"><div><h3 className="font-semibold text-stone-800">{cat.nombre}</h3><p className="text-xs text-stone-400 mt-0.5">{(cfg.negocio as string) || '—'}</p></div>
                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${cat.activo ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-400'}`}>{cat.activo ? 'Activo' : 'Inactivo'}</span></div>
                  <p className="text-xs text-stone-400 mb-4">{cat._count?.productos || 0} productos · {new Date(cat.createdAt).toLocaleDateString('es-CO')}</p>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(cat)} className="flex-1 text-center py-2 text-xs text-wine border border-stone-200 rounded hover:border-wine/20 hover:bg-wine/5 cursor-pointer transition-colors">Editar</button>
                    <button onClick={() => copyLink(cat.slug)} className="p-2 text-stone-400 hover:text-wine cursor-pointer"><Copy size={14} /></button>
                    <a href={`/c/${cat.slug}`} target="_blank" rel="noopener noreferrer" className="p-2 text-stone-400 hover:text-wine cursor-pointer"><Eye size={14} /></a>
                    <button onClick={() => handleToggle(cat.id)} className="p-2 text-stone-400 hover:text-wine cursor-pointer">{cat.activo ? <ToggleRight size={14} className="text-emerald-500" /> : <ToggleLeft size={14} />}</button>
                    <button onClick={() => handleDelete(cat.id)} className="p-2 text-stone-400 hover:text-red-500 cursor-pointer"><Trash2 size={14} /></button>
                  </div>
                </div>
              </motion.div>
            ); })}
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 cursor-pointer z-10"><X size={18} /></button>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-stone-800 mb-1" style={{ fontFamily: 'var(--font-display)' }}>{editingId ? 'Editar' : 'Nuevo'} Catálogo</h2>
                <div className="flex items-center gap-2 mb-6">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${step === 1 ? 'bg-wine text-white' : 'bg-stone-100 text-stone-400'}`}>1. Info</span>
                  <ChevronRight size={12} className="text-stone-300" />
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${step === 2 ? 'bg-wine text-white' : 'bg-stone-100 text-stone-400'}`}>2. Productos</span>
                </div>

                {step === 1 && (
                  <div className="space-y-4">
                    <div><label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">Nombre del catálogo</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-wine/30" /></div>
                    <div><label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">Nombre de tu negocio</label><input value={form.negocio} onChange={(e) => setForm({ ...form, negocio: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-wine/30" /></div>
                    <div className="flex items-center gap-4">
                      <div><label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">Color</label><div className="flex items-center gap-2"><input type="color" value={form.color_principal} onChange={(e) => setForm({ ...form, color_principal: e.target.value })} className="w-10 h-10 rounded border border-stone-200 cursor-pointer" /><span className="text-xs text-stone-400 font-mono">{form.color_principal}</span></div></div>
                      <div className="flex-1"><label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">Mostrar precios</label><button type="button" onClick={() => setForm({ ...form, mostrar_precios: !form.mostrar_precios })} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${form.mostrar_precios ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-stone-200 text-stone-500'}`}>{form.mostrar_precios ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}<span className="text-sm">{form.mostrar_precios ? 'Sí' : 'No'}</span></button></div>
                    </div>
                    <button onClick={() => setStep(2)} disabled={!form.nombre || !form.negocio} className="w-full bg-wine text-white py-3 rounded-lg text-sm font-semibold uppercase tracking-wider cursor-pointer hover:bg-wine-light transition-colors disabled:opacity-40 flex items-center justify-center gap-2">Siguiente <ChevronRight size={14} /></button>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <div className="flex gap-3 mb-4">
                      <div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" /><input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-300" /></div>
                      <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="px-3 py-2 border border-stone-200 rounded-lg text-sm cursor-pointer focus:outline-none"><option value="Todas">Todas</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                    </div>
                    {selectedProducts.length > 0 && <div className="bg-ivory rounded-lg p-3 mb-4"><p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold mb-2">{selectedProducts.length} seleccionados</p><div className="flex flex-wrap gap-1.5">{selectedProducts.map((sp) => <span key={sp.productId} className="inline-flex items-center gap-1 text-[10px] bg-white border border-stone-200 px-2 py-1 rounded">{sp.nombre}<button onClick={() => setSelectedProducts((p) => p.filter((x) => x.productId !== sp.productId))} className="text-stone-400 hover:text-red-500 cursor-pointer"><X size={10} /></button></span>)}</div></div>}
                    <div className="max-h-[40vh] overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100">
                      {filtered.map((p) => { const isSel = selectedProducts.some((sp) => sp.productId === p.id); return (
                        <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${isSel ? 'bg-wine/[0.03]' : 'hover:bg-stone-50'}`}>
                          <button onClick={() => toggleProduct(p)} className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer flex-shrink-0 ${isSel ? 'bg-wine border-wine text-white' : 'border-stone-300'}`}>{isSel && <Check size={12} />}</button>
                          {p.imagen ? <Image src={p.imagen} alt="" width={40} height={40} className="object-cover rounded bg-stone-100 flex-shrink-0" /> : <div className="w-10 h-10 rounded bg-stone-100 flex-shrink-0" />}
                          <div className="flex-1 min-w-0"><p className="text-sm text-stone-700 truncate">{p.nombre}</p><p className="text-[10px] text-stone-400">{p.ref}</p></div>
                        </div>
                      ); })}
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button onClick={() => setStep(1)} className="flex-1 py-3 border border-stone-200 rounded-lg text-sm text-stone-600 cursor-pointer hover:bg-stone-50">← Atrás</button>
                      <button onClick={handleSave} disabled={saving} className="flex-1 bg-wine text-white py-3 rounded-lg text-sm font-semibold uppercase tracking-wider cursor-pointer hover:bg-wine-light disabled:opacity-40 flex items-center justify-center gap-2">{saving && <Loader2 size={14} className="animate-spin" />}{editingId ? 'Guardar' : 'Crear'}</button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Eliminar catálogo"
        message="¿Eliminar este catálogo? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        onConfirm={confirmDeleteCatalogo}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
