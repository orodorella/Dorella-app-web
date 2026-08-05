'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { useToast } from '@/context/ToastProvider';
import ImageUploader, { type ImageUploaderHandle } from '@/components/admin/ImageUploader';
import {
  Package,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Search,
  RotateCcw,
} from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface ProductRow {
  id: string;
  sku: string;
  nombre: string;
  precioBase: number;
  stock: number;
  isActive: boolean;
  imagenes: string[];
  categoria: { id: string; nombre: string; slug?: string } | null;
  material: string | null;
  referenciaProveedor: string | null;
  proveedor: string | null;
  isFeatured: boolean;
  descripcion: string | null;
}

interface Category {
  id: string;
  nombre: string;
  slug: string;
}

interface Meta {
  page: number;
  pageSize: number;
  total: number;
}

type StockFilter = 'all' | 'in_stock' | 'out_of_stock';

export default function AdminProductosPage() {
  const { showToast } = useToast();
  const [allProducts, setAllProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catalogMeta, setCatalogMeta] = useState<Meta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [formData, setFormData] = useState({
    sku: '',
    nombre: '',
    descripcion: '',
    precioBase: '',
    stock: '0',
    categoryId: '',
    material: '',
    referenciaProveedor: '',
    proveedor: '',
    isFeatured: false,
  });
  const [formImages, setFormImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const imageUploaderRef = useRef<ImageUploaderHandle>(null);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);
  const [changingVisibilityId, setChangingVisibilityId] = useState<string | null>(null);

  const loadProducts = useCallback(() => {
    setLoading(true);

    request('GET', '/api/admin/products?page=1&pageSize=100')
      .then(async (res) => {
        if (res.success) {
          const firstPageProducts = res.data as ProductRow[];
          const responseMeta = res.meta as Meta | undefined;

          if (!responseMeta) {
            setAllProducts(firstPageProducts);
            setCatalogMeta({
              page: 1,
              pageSize: firstPageProducts.length,
              total: firstPageProducts.length,
            });
            return;
          }

          const totalPages = Math.max(1, Math.ceil(responseMeta.total / responseMeta.pageSize));

          if (totalPages === 1) {
            setAllProducts(firstPageProducts);
            setCatalogMeta(responseMeta);
            return;
          }

          const loadedProducts = [...firstPageProducts];

          for (let nextPage = 2; nextPage <= totalPages; nextPage += 1) {
            const response = await request('GET', `/api/admin/products?page=${nextPage}&pageSize=${responseMeta.pageSize}`);
            if (response.success) {
              loadedProducts.push(...(response.data as ProductRow[]));
            }
          }

          const dedupedProducts = Array.from(
            new Map(loadedProducts.map((product) => [product.id, product])).values(),
          );

          setAllProducts(dedupedProducts);
          setCatalogMeta(responseMeta);
        }
      })
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    request('GET', '/api/categories')
      .then((res) => {
        if (res.success) {
          setCategories(res.data);
        }
      })
      .catch((e: Error) => showToast(e.message, 'error'));
  }, [showToast]);

  useEffect(() => {
    setPage(1);
  }, [search, stockFilter, categoryFilter]);

  function openCreate() {
    setEditingProduct(null);
    setFormData({
      sku: '',
      nombre: '',
      descripcion: '',
      precioBase: '',
      stock: '0',
      categoryId: categories[0]?.id || '',
      material: '',
      referenciaProveedor: '',
      proveedor: '',
      isFeatured: false,
    });
    setFormImages([]);
    setShowForm(true);
  }

  function openEdit(product: ProductRow) {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      nombre: product.nombre,
      descripcion: product.descripcion || '',
      precioBase: String(product.precioBase),
      stock: String(product.stock),
      categoryId: product.categoria?.id || '',
      material: product.material || '',
      referenciaProveedor: product.referenciaProveedor || '',
      proveedor: product.proveedor || '',
      isFeatured: product.isFeatured,
    });
    setFormImages(product.imagenes || []);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const data = {
        sku: formData.sku,
        nombre: formData.nombre,
        descripcion: formData.descripcion || undefined,
        precioBase: Number(formData.precioBase),
        stock: Number(formData.stock),
        categoryId: formData.categoryId,
        material: formData.material || undefined,
        referenciaProveedor: formData.referenciaProveedor || undefined,
        proveedor: formData.proveedor || undefined,
        isFeatured: formData.isFeatured,
        imagenes: formImages,
      };

      let productId: string;

      if (editingProduct) {
        const res = await request('PUT', `/api/admin/products/${editingProduct.id}`, data);
        if (!res.success) throw new Error(res.error?.message || 'Error actualizando producto');
        productId = editingProduct.id;
        showToast('Producto actualizado');
      } else {
        const res = await request('POST', '/api/admin/products', data);
        if (!res.success) throw new Error(res.error?.message || 'Error creando producto');
        productId = res.data.id;

        if (imageUploaderRef.current) {
          await imageUploaderRef.current.uploadPendingFiles(productId);
        }

        showToast('Producto creado');
      }

      setShowForm(false);
      loadProducts();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string) {
    setConfirmDeactivateId(id);
  }

  async function confirmDeactivate() {
    if (!confirmDeactivateId) return;

    try {
      await request('DELETE', `/api/admin/products/${confirmDeactivateId}`);
      showToast('Producto desactivado');
      loadProducts();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setConfirmDeactivateId(null);
    }
  }

  async function handleStockChange(id: string, stock: string) {
    try {
      await request('PATCH', `/api/admin/products/${id}/stock`, { stock: Number(stock) });
      loadProducts();
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  async function handleVisibilityChange(product: ProductRow) {
    setChangingVisibilityId(product.id);

    try {
      await request('PATCH', `/api/admin/products/${product.id}/visibility`, {
        isActive: !product.isActive,
      });
      showToast(product.isActive ? 'Producto ocultado' : 'Producto visible');
      loadProducts();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setChangingVisibilityId(null);
    }
  }

  function clearFilters() {
    setSearch('');
    setStockFilter('all');
    setCategoryFilter('');
  }

  const hasActiveFilters = search.trim().length > 0 || stockFilter !== 'all' || categoryFilter !== '';
  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const selectedCategory = categories.find((category) => category.slug === categoryFilter);

    return allProducts.filter((product) => {
      const matchesSearch = normalizedSearch.length === 0 || [
        product.nombre,
        product.sku,
        product.categoria?.nombre ?? '',
        product.categoria?.slug ?? '',
        product.descripcion ?? '',
        product.material ?? '',
      ].some((value) => value.toLowerCase().includes(normalizedSearch));

      const matchesCategory = !categoryFilter
        || product.categoria?.slug === categoryFilter
        || product.categoria?.nombre.toLowerCase() === selectedCategory?.nombre.toLowerCase();

      const matchesStock = stockFilter === 'all'
        || (stockFilter === 'in_stock' && product.stock > 0)
        || (stockFilter === 'out_of_stock' && product.stock <= 0);

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [allProducts, categories, categoryFilter, search, stockFilter]);

  const visualPageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / visualPageSize));
  const renderedProducts = useMemo(() => {
    const start = (page - 1) * visualPageSize;
    return filteredProducts.slice(start, start + visualPageSize);
  }, [filteredProducts, page]);
  const pageStart = filteredProducts.length === 0 ? 0 : (page - 1) * visualPageSize + 1;
  const pageEnd = Math.min(page * visualPageSize, filteredProducts.length);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
            Productos
          </h1>
          <p className="text-sm text-stone-400">Gestión del catálogo</p>
        </div>

        <button
          onClick={openCreate}
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-wine px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-wine-light"
        >
          <Plus size={16} />
          Nuevo Producto
        </button>
      </div>

      <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, referencia o categoría"
              className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-10 pr-4 text-sm text-stone-700 outline-none transition-colors placeholder:text-stone-400 focus:border-wine/30"
            />
          </label>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="min-w-[220px] rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 outline-none transition-colors focus:border-wine/30"
          >
            <option value="">Todas las categorías</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.nombre}
              </option>
            ))}
          </select>

          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as StockFilter)}
            className="min-w-[180px] rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 outline-none transition-colors focus:border-wine/30"
          >
            <option value="all">Todos</option>
            <option value="in_stock">Con stock</option>
            <option value="out_of_stock">Sin stock</option>
          </select>

          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RotateCcw size={14} />
            Limpiar filtros
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-stone-500">
            {hasActiveFilters
              ? `Mostrando ${filteredProducts.length} de ${allProducts.length} productos`
              : `Mostrando ${pageStart}-${pageEnd} de ${catalogMeta?.total ?? allProducts.length} productos`}
          </p>
          {hasActiveFilters ? <p className="text-xs text-wine/80">Filtros activos</p> : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 size={28} className="mx-auto animate-spin text-wine" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-stone-400">
            <Package size={40} className="mx-auto mb-3 text-stone-200" />
            <p className="text-base text-stone-600">No encontramos productos con esos filtros.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
            >
              <RotateCcw size={14} />
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-[10px] uppercase tracking-wider text-stone-400">
                  <th className="px-6 py-3 text-left font-medium">Producto</th>
                  <th className="px-6 py-3 text-left font-medium">SKU</th>
                  <th className="px-6 py-3 text-left font-medium">Categoría</th>
                  <th className="px-6 py-3 text-right font-medium">Precio Base</th>
                  <th className="px-6 py-3 text-center font-medium">Stock</th>
                  <th className="px-6 py-3 text-center font-medium">Activo</th>
                  <th className="px-6 py-3 text-center font-medium">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {renderedProducts.map((product, index) => (
                  <tr
                    key={product.id}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-ivory/50'} transition-colors hover:bg-stone-50`}
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        {product.imagenes?.[0] ? (
                          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-stone-100">
                            <Image
                              src={product.imagenes[0]}
                              alt=""
                              width={40}
                              height={40}
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-stone-100 text-[9px] text-stone-300">
                            {product.sku}
                          </div>
                        )}
                        <span className="font-medium text-stone-700">{product.nombre}</span>
                      </div>
                    </td>

                    <td className="px-6 py-3.5 font-mono text-xs text-stone-500">{product.sku}</td>
                    <td className="px-6 py-3.5 text-stone-500">{product.categoria?.nombre || '—'}</td>
                    <td
                      className="px-6 py-3.5 text-right font-medium text-stone-700"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatCOP(product.precioBase)}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <input
                        type="number"
                        min="0"
                        defaultValue={product.stock}
                        onBlur={(e) => handleStockChange(product.id, e.target.value)}
                        className="w-16 rounded border border-stone-200 py-1 text-center text-sm focus:border-stone-300 focus:outline-none"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      />
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <button
                        onClick={() => handleVisibilityChange(product)}
                        disabled={changingVisibilityId === product.id}
                        title={product.isActive ? 'Ocultar de la tienda' : 'Mostrar en la tienda'}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium disabled:opacity-50 ${
                          product.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        {changingVisibilityId === product.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : product.isActive ? (
                          <Eye size={12} />
                        ) : (
                          <EyeOff size={12} />
                        )}
                        {product.isActive ? 'Visible' : 'Oculto'}
                      </button>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(product)}
                          className="cursor-pointer p-1.5 text-stone-400 hover:text-wine"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-stone-100 px-6 py-4">
            <p className="text-xs text-stone-400">
              {hasActiveFilters
                ? `${filteredProducts.length} productos filtrados`
                : `${catalogMeta?.total ?? allProducts.length} productos`}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="cursor-pointer rounded border border-stone-200 p-2 hover:bg-stone-50 disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 text-xs text-stone-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="cursor-pointer rounded border border-stone-200 p-2 hover:bg-stone-50 disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
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
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-stone-500">SKU</label>
                    <input
                      required
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-300 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-stone-500">Categoría</label>
                    <select
                      required
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className="w-full cursor-pointer rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:outline-none"
                    >
                      <option value="">Seleccionar...</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wider text-stone-500">Nombre</label>
                  <input
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-300 focus:outline-none"
                  />
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
                      Precio Base (COP)
                    </label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={formData.precioBase}
                      onChange={(e) => setFormData({ ...formData, precioBase: e.target.value })}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-300 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-stone-500">Stock</label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-300 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-stone-500">
                      Referencia proveedor
                    </label>
                    <input
                      value={formData.referenciaProveedor}
                      onChange={(e) => setFormData({ ...formData, referenciaProveedor: e.target.value })}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-300 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-stone-500">Proveedor</label>
                    <input
                      value={formData.proveedor}
                      onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-300 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-stone-500">Material</label>
                    <input
                      value={formData.material}
                      onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-300 focus:outline-none"
                    />
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isFeatured}
                    onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-stone-600">Producto destacado</span>
                </label>

                <ImageUploader
                  ref={imageUploaderRef}
                  productId={editingProduct?.id}
                  images={formImages}
                  onImagesChange={setFormImages}
                />
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
                  {editingProduct ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeactivateId}
        title="Desactivar producto"
        message="¿Desactivar este producto? No será visible para los clientes."
        confirmLabel="Desactivar"
        danger
        onConfirm={confirmDeactivate}
        onCancel={() => setConfirmDeactivateId(null)}
      />
    </div>
  );
}
