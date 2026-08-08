'use client';

import { useState, useEffect, useCallback } from 'react';
import { request } from '@/hooks/useApi';
import { useToast } from '@/context/ToastProvider';
import {
  Tag,
  Plus,
  Loader2,
  X,
  Edit,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface CategoryRow {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  imagenUrl: string | null;
  orden: number;
  isActive: boolean;
  productCount: number;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AdminCategoriasPage() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    slug: '',
    descripcion: '',
    imagenUrl: '',
    orden: '0',
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [changingVisibilityId, setChangingVisibilityId] = useState<string | null>(null);

  const loadCategories = useCallback(() => {
    setLoading(true);
    request('GET', '/api/admin/categories')
      .then((res) => {
        if (res.success) setCategories(res.data);
      })
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  function openCreate() {
    setEditingCategory(null);
    setFormData({ nombre: '', slug: '', descripcion: '', imagenUrl: '', orden: String(categories.length) });
    setSlugTouched(false);
    setShowForm(true);
  }

  function openEdit(category: CategoryRow) {
    setEditingCategory(category);
    setFormData({
      nombre: category.nombre,
      slug: category.slug,
      descripcion: category.descripcion || '',
      imagenUrl: category.imagenUrl || '',
      orden: String(category.orden),
    });
    setSlugTouched(true);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const data = {
        nombre: formData.nombre.trim(),
        slug: slugify(formData.slug),
        descripcion: formData.descripcion.trim() || undefined,
        imagenUrl: formData.imagenUrl.trim() || undefined,
        orden: Number(formData.orden) || 0,
      };

      if (editingCategory) {
        const res = await request('PUT', `/api/admin/categories/${editingCategory.id}`, data);
        if (!res.success) throw new Error(res.error?.message || 'Error actualizando categoría');
        showToast('Categoría actualizada');
      } else {
        const res = await request('POST', '/api/admin/categories', data);
        if (!res.success) throw new Error(res.error?.message || 'Error creando categoría');
        showToast('Categoría creada');
      }

      setShowForm(false);
      loadCategories();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return;

    try {
      await request('DELETE', `/api/admin/categories/${confirmDeleteId}`);
      showToast('Categoría eliminada');
      loadCategories();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setConfirmDeleteId(null);
    }
  }

  async function handleVisibilityChange(category: CategoryRow) {
    setChangingVisibilityId(category.id);

    try {
      await request('PATCH', `/api/admin/categories/${category.id}/visibility`, {
        isActive: !category.isActive,
      });
      showToast(category.isActive ? 'Categoría ocultada' : 'Categoría visible');
      loadCategories();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setChangingVisibilityId(null);
    }
  }

  const deletingCategory = categories.find((c) => c.id === confirmDeleteId) || null;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-1 text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
            Categorías
          </h1>
          <p className="text-sm text-stone-400">Organiza el catálogo por categorías</p>
        </div>

        <button
          onClick={openCreate}
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-wine px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-wine-light"
        >
          <Plus size={16} />
          Nueva Categoría
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 size={28} className="mx-auto animate-spin text-wine" />
          </div>
        ) : categories.length === 0 ? (
          <div className="py-16 text-center text-stone-400">
            <Tag size={40} className="mx-auto mb-3 text-stone-200" />
            <p className="text-base text-stone-600">Todavía no hay categorías.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-[10px] uppercase tracking-wider text-stone-400">
                  <th className="px-6 py-3 text-left font-medium">Categoría</th>
                  <th className="px-6 py-3 text-left font-medium">Slug</th>
                  <th className="px-6 py-3 text-center font-medium">Productos</th>
                  <th className="px-6 py-3 text-center font-medium">Orden</th>
                  <th className="px-6 py-3 text-center font-medium">Activa</th>
                  <th className="px-6 py-3 text-center font-medium">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {categories.map((category, index) => (
                  <tr
                    key={category.id}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-ivory/50'} transition-colors hover:bg-stone-50`}
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-wine/10 text-wine">
                          <Tag size={15} />
                        </div>
                        <div>
                          <span className="font-medium text-stone-700">{category.nombre}</span>
                          {category.descripcion && (
                            <p className="max-w-xs truncate text-xs text-stone-400">{category.descripcion}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs text-stone-500">{category.slug}</td>
                    <td className="px-6 py-3.5 text-center text-stone-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {category.productCount}
                    </td>
                    <td className="px-6 py-3.5 text-center text-stone-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {category.orden}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <button
                        onClick={() => handleVisibilityChange(category)}
                        disabled={changingVisibilityId === category.id}
                        title={category.isActive ? 'Ocultar de la tienda' : 'Mostrar en la tienda'}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium disabled:opacity-50 ${
                          category.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        {changingVisibilityId === category.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : category.isActive ? (
                          <Eye size={12} />
                        ) : (
                          <EyeOff size={12} />
                        )}
                        {category.isActive ? 'Visible' : 'Oculta'}
                      </button>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(category)}
                          className="cursor-pointer p-1.5 text-stone-400 hover:text-wine"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(category.id)}
                          className="cursor-pointer p-1.5 text-stone-400 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowForm(false)}
              className="absolute right-4 top-4 cursor-pointer text-stone-400 hover:text-stone-600"
            >
              <X size={18} />
            </button>

            <form onSubmit={handleSubmit} className="p-6">
              <h3 className="mb-6 text-xl font-semibold text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wider text-stone-500">Nombre</label>
                  <input
                    required
                    value={formData.nombre}
                    onChange={(e) => {
                      const nombre = e.target.value;
                      setFormData((current) => ({
                        ...current,
                        nombre,
                        slug: slugTouched ? current.slug : slugify(nombre),
                      }));
                    }}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-300 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wider text-stone-500">Slug (URL)</label>
                  <input
                    required
                    value={formData.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setFormData({ ...formData, slug: e.target.value });
                    }}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2.5 font-mono text-sm focus:border-stone-300 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-stone-400">Se usa en la URL del catálogo: /catalogo/{slugify(formData.slug) || 'ejemplo'}</p>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wider text-stone-500">Descripción</label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-300 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-stone-500">
                      Imagen (URL)
                    </label>
                    <input
                      type="url"
                      value={formData.imagenUrl}
                      onChange={(e) => setFormData({ ...formData, imagenUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-300 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-stone-500">Orden</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.orden}
                      onChange={(e) => setFormData({ ...formData, orden: e.target.value })}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-300 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 cursor-pointer rounded-lg border border-stone-200 py-2.5 text-sm text-stone-600 transition-colors hover:bg-stone-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-wine py-2.5 text-sm font-semibold text-white transition-colors hover:bg-wine-light disabled:opacity-40"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editingCategory ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Eliminar categoría"
        message={
          deletingCategory && deletingCategory.productCount > 0
            ? `Esta categoría tiene ${deletingCategory.productCount} producto(s) asociado(s), así que se ocultará en vez de borrarse por completo.`
            : '¿Eliminar esta categoría? Esta acción no se puede deshacer.'
        }
        confirmLabel="Eliminar"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
