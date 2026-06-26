'use client';

import { useState, useEffect, useCallback } from 'react';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { useToast } from '@/context/ToastProvider';
import { Package, Plus, ChevronLeft, ChevronRight, Loader2, X, Edit, Trash2 } from 'lucide-react';

interface ProductRow { id: string; sku: string; nombre: string; precioBase: number; stock: number; isActive: boolean; imagenes: string[]; categoria: { id: string; nombre: string }; material: string | null; isFeatured: boolean; descripcion: string | null; }
interface Category { id: string; nombre: string; }
interface Meta { page: number; pageSize: number; total: number; }

export default function AdminProductosPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [formData, setFormData] = useState({ sku: '', nombre: '', descripcion: '', precioBase: '', stock: '0', categoryId: '', material: 'Oro laminado 18k', isFeatured: false });
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(() => {
    setLoading(true);
    request('GET', `/api/admin/products?page=${page}&pageSize=10`)
      .then((res) => { if (res.success) { setProducts(res.data); setMeta(res.meta); } })
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [page, showToast]);

  useEffect(() => {
    loadProducts();
    request('GET', '/api/categories').then((res) => { if (res.success) setCategories(res.data); });
  }, [loadProducts]);

  function openCreate() {
    setEditingProduct(null);
    setFormData({ sku: '', nombre: '', descripcion: '', precioBase: '', stock: '0', categoryId: categories[0]?.id || '', material: 'Oro laminado 18k', isFeatured: false });
    setShowForm(true);
  }

  function openEdit(p: ProductRow) {
    setEditingProduct(p);
    setFormData({ sku: p.sku, nombre: p.nombre, descripcion: p.descripcion || '', precioBase: String(p.precioBase), stock: String(p.stock), categoryId: p.categoria?.id || '', material: p.material || '', isFeatured: p.isFeatured });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { sku: formData.sku, nombre: formData.nombre, descripcion: formData.descripcion || undefined, precioBase: Number(formData.precioBase), stock: Number(formData.stock), categoryId: formData.categoryId, material: formData.material || undefined, isFeatured: formData.isFeatured };
      if (editingProduct) { await request('PUT', `/api/admin/products/${editingProduct.id}`, data); showToast('Producto actualizado'); }
      else { await request('POST', '/api/admin/products', data); showToast('Producto creado'); }
      setShowForm(false);
      loadProducts();
    } catch (e) { showToast((e as Error).message, 'error'); } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Desactivar este producto?')) return;
    try { await request('DELETE', `/api/admin/products/${id}`); showToast('Producto desactivado'); loadProducts(); } catch (e) { showToast((e as Error).message, 'error'); }
  }

  async function handleStockChange(id: string, stock: string) {
    try { await request('PATCH', `/api/admin/products/${id}/stock`, { stock: Number(stock) }); loadProducts(); } catch (e) { showToast((e as Error).message, 'error'); }
  }

  const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-3xl text-stone-800 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Productos</h1><p className="text-sm text-stone-400">Gestión del catálogo</p></div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-wine text-white px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer hover:bg-wine-light transition-colors"><Plus size={16} /> Nuevo Producto</button>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        {loading ? <div className="text-center py-16"><Loader2 size={28} className="animate-spin text-wine mx-auto" /></div>
        : products.length === 0 ? <div className="text-center py-16 text-stone-400"><Package size={40} className="mx-auto mb-3 text-stone-200" /><p>No hay productos</p></div>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] text-stone-400 uppercase tracking-wider border-b border-stone-100">
                <th className="text-left px-6 py-3 font-medium">Producto</th><th className="text-left px-6 py-3 font-medium">SKU</th>
                <th className="text-left px-6 py-3 font-medium">Categoría</th><th className="text-right px-6 py-3 font-medium">Precio Base</th>
                <th className="text-center px-6 py-3 font-medium">Stock</th><th className="text-center px-6 py-3 font-medium">Activo</th>
                <th className="text-center px-6 py-3 font-medium">Acciones</th>
              </tr></thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={p.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-ivory/50'} hover:bg-stone-50 transition-colors`}>
                    <td className="px-6 py-3.5"><div className="flex items-center gap-3">{p.imagenes?.[0] ? <img src={p.imagenes[0]} alt="" className="w-10 h-10 rounded object-cover bg-stone-100" /> : <div className="w-10 h-10 rounded bg-stone-100 flex items-center justify-center text-stone-300 text-[9px]">{p.sku}</div>}<span className="font-medium text-stone-700">{p.nombre}</span></div></td>
                    <td className="px-6 py-3.5 text-stone-500 font-mono text-xs">{p.sku}</td>
                    <td className="px-6 py-3.5 text-stone-500">{p.categoria?.nombre || '—'}</td>
                    <td className="px-6 py-3.5 text-right font-medium text-stone-700" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCOP(p.precioBase)}</td>
                    <td className="px-6 py-3.5 text-center">
                      <input type="number" min="0" defaultValue={p.stock} onBlur={(e) => handleStockChange(p.id, e.target.value)}
                        className="w-16 text-center py-1 border border-stone-200 rounded text-sm focus:outline-none focus:border-stone-300" style={{ fontVariantNumeric: 'tabular-nums' }} />
                    </td>
                    <td className="px-6 py-3.5 text-center"><span className={`inline-block w-2.5 h-2.5 rounded-full ${p.isActive ? 'bg-emerald-500' : 'bg-stone-300'}`} /></td>
                    <td className="px-6 py-3.5 text-center"><div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 text-stone-400 hover:text-wine cursor-pointer"><Edit size={14} /></button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 text-stone-400 hover:text-red-500 cursor-pointer"><Trash2 size={14} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100">
            <p className="text-xs text-stone-400">{meta.total} productos</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-2 border border-stone-200 rounded disabled:opacity-30 cursor-pointer hover:bg-stone-50"><ChevronLeft size={14} /></button>
              <span className="text-xs text-stone-500 px-2">{page} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-2 border border-stone-200 rounded disabled:opacity-30 cursor-pointer hover:bg-stone-50"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 cursor-pointer"><X size={18} /></button>
            <form onSubmit={handleSubmit} className="p-6">
              <h3 className="text-xl font-semibold text-stone-800 mb-6" style={{ fontFamily: 'var(--font-display)' }}>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">SKU</label><input required value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-300" /></div>
                  <div><label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">Categoría</label><select required value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm cursor-pointer focus:outline-none"><option value="">Seleccionar...</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                </div>
                <div><label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">Nombre</label><input required value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-300" /></div>
                <div><label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">Descripción</label><textarea value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} rows={3} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-300 resize-none" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">Precio Base (COP)</label><input required type="number" min="1" value={formData.precioBase} onChange={(e) => setFormData({ ...formData, precioBase: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-300" /></div>
                  <div><label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">Stock</label><input required type="number" min="0" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-300" /></div>
                </div>
                <div><label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">Material</label><input value={formData.material} onChange={(e) => setFormData({ ...formData, material: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-300" /></div>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formData.isFeatured} onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })} className="rounded" /><span className="text-sm text-stone-600">Producto destacado</span></label>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-600 cursor-pointer hover:bg-stone-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-wine text-white rounded-lg text-sm font-semibold cursor-pointer hover:bg-wine-light transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}{editingProduct ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
