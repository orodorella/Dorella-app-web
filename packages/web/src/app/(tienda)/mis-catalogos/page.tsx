'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  Plus,
  FileText,
  Trash2,
  Copy,
  ToggleLeft,
  ToggleRight,
  Loader2,
  X,
  Search,
  Check,
  ChevronRight,
} from 'lucide-react';
import Image from 'next/image';

import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastProvider';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';

interface CatalogoItem {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
  configuracion: Record<string, unknown>;
  createdAt: string;
  _count?: { productos: number };
}

interface CatalogCategory {
  id: string;
  nombre: string;
  slug: string;
}

interface CatalogPickerProduct {
  id: string;
  sku: string;
  nombre: string;
  precio: number;
  imagenes: string[];
  material: string | null;
  stock: number;
  isActive: boolean;
  categoryId: string;
  categoria: CatalogCategory;
}

interface SelectedProduct {
  productId: string;
  nombre: string;
  precioPersonalizado: number | null;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  activeTotal?: number;
}

const INITIAL_FORM = {
  nombre: '',
  negocio: '',
  logo_url: '',
  color_principal: '#1A1A1A',
  mostrar_precios: false,
  modo_precios: 'detal' as 'detal' | 'personalizado',
};

const INITIAL_META: PaginationMeta = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  activeTotal: 0,
};

function mergeUniqueProducts(current: CatalogPickerProduct[], incoming: CatalogPickerProduct[]) {
  const byId = new Map(current.map((product) => [product.id, product]));

  for (const product of incoming) {
    byId.set(product.id, product);
  }

  return Array.from(byId.values());
}

export default function MisCatalogosPage() {
  const { showToast } = useToast();
  const [list, setList] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [productOptions, setProductOptions] = useState<CatalogPickerProduct[]>([]);
  const [productMeta, setProductMeta] = useState<PaginationMeta>(INITIAL_META);
  const [productLoading, setProductLoading] = useState(false);
  const [productLoadingMore, setProductLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [includeAllProducts, setIncludeAllProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  const selectedIds = useMemo(
    () => new Set(selectedProducts.map((product) => product.productId)),
    [selectedProducts],
  );

  useEffect(() => {
    void loadCatalogos();
  }, []);

  useEffect(() => {
    if (!showModal) return;

    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput, showModal]);

  useEffect(() => {
    if (!showModal) return;

    void loadSelectableProducts(1, false);
  }, [showModal, debouncedSearch, categoryFilter]);

  async function loadCatalogos() {
    setLoading(true);

    try {
      const res = await request('GET', '/api/catalogos');
      if (res.success) {
        setList(res.data);
      }
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const res = await request('GET', '/api/categories');
      if (res.success) {
        setCategories(
          res.data.map((category: CatalogCategory) => ({
            id: category.id,
            nombre: category.nombre,
            slug: category.slug,
          })),
        );
      }
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  }

  async function loadSelectableProducts(page: number, append: boolean) {
    const version = ++requestVersionRef.current;

    if (append) {
      setProductLoadingMore(true);
    } else {
      setProductLoading(true);
    }

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(INITIAL_META.pageSize),
      });

      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }

      if (categoryFilter !== 'all') {
        params.set('categoryId', categoryFilter);
      }

      const res = await request('GET', `/api/catalogos/productos?${params.toString()}`);

      if (!res.success || version !== requestVersionRef.current) {
        return;
      }

      const nextProducts = res.data.map((product: CatalogPickerProduct) => ({
        id: product.id,
        sku: product.sku,
        nombre: product.nombre,
        precio: product.precio,
        imagenes: product.imagenes || [],
        material: product.material ?? null,
        stock: product.stock,
        isActive: product.isActive,
        categoryId: product.categoryId,
        categoria: product.categoria,
      }));

      setProductOptions((current) => (append ? mergeUniqueProducts(current, nextProducts) : nextProducts));
      setProductMeta({
        page: res.meta?.page ?? page,
        pageSize: res.meta?.pageSize ?? INITIAL_META.pageSize,
        total: res.meta?.total ?? nextProducts.length,
        totalPages: res.meta?.totalPages ?? 1,
        hasNextPage: Boolean(res.meta?.hasNextPage),
        activeTotal: res.meta?.activeTotal ?? INITIAL_META.activeTotal,
      });
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      if (append) {
        setProductLoadingMore(false);
      } else {
        setProductLoading(false);
      }
    }
  }

  function resetProductPickerState() {
    setProductOptions([]);
    setProductMeta(INITIAL_META);
    setProductLoading(false);
    setProductLoadingMore(false);
    setSearchInput('');
    setDebouncedSearch('');
    setCategoryFilter('all');
    setIncludeAllProducts(false);
    requestVersionRef.current += 1;
  }

  function openCreate() {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setSelectedProducts([]);
    setStep(1);
    resetProductPickerState();
    setShowModal(true);
    void loadCategories();
  }

  async function openEdit(catalogo: CatalogoItem) {
    const config = catalogo.configuracion || {};

    setEditingId(catalogo.id);
   setForm({
  nombre: catalogo.nombre,
  negocio: (config.negocio as string) || '',
  logo_url: (config.logo_url as string) || '',
  color_principal: (config.color_principal as string) || '#1A1A1A',
  mostrar_precios: (config.mostrar_precios as boolean) || false,
  modo_precios: config.modo_precios === 'personalizado' ? 'personalizado' : 'detal',
});
    setSelectedProducts([]);
    setStep(1);
    resetProductPickerState();
    setShowModal(true);
    void loadCategories();

    try {
      const res = await request('GET', `/api/catalogos/${catalogo.id}`);
      if (res.success) {
        setSelectedProducts(
          res.data.productos.map(
            (product: { product: { id: string; nombre: string }; precioPersonalizado: number | null }) => ({
              productId: product.product.id,
              nombre: product.product.nombre,
              precioPersonalizado: product.precioPersonalizado,
            }),
          ),
        );
      }
    } catch {
      // keep modal open even if selected products fail to load
    }
  }

  function toggleProduct(product: CatalogPickerProduct) {
    if (includeAllProducts) return;

    setSelectedProducts((current) => {
      const exists = current.some((item) => item.productId === product.id);
      if (exists) {
        return current.filter((item) => item.productId !== product.id);
      }

      return [
        ...current,
        {
          productId: product.id,
          nombre: product.nombre,
          precioPersonalizado: null,
        },
      ];
    });
  }

  async function handleSave() {
    setSaving(true);

    try {
      const configuracion = {
  negocio: form.negocio,
  logo_url: form.logo_url || null,
  color_principal: form.color_principal,
  mostrar_precios: form.mostrar_precios,
  modo_precios: form.modo_precios,
};

      if (editingId) {
        await request('PUT', `/api/catalogos/${editingId}`, {
          nombre: form.nombre,
          configuracion,
        });

        if (selectedProducts.length > 0) {
          await request('POST', `/api/catalogos/${editingId}/productos`, {
            productos: selectedProducts.map((product) => ({
              productId: product.productId,
              precioPersonalizado: product.precioPersonalizado,
            })),
          });
        }

        showToast('Catálogo actualizado');
      } else {
        if (!includeAllProducts && selectedProducts.length === 0) {
          showToast('Selecciona al menos un producto o activa "Seleccionar todos los productos".', 'error');
          return;
        }

        await request('POST', '/api/catalogos', {
          nombre: form.nombre,
          configuracion,
          includeAllProducts,
          productIds: includeAllProducts ? [] : selectedProducts.map((product) => product.productId),
        });

        showToast('Catálogo creado');
      }

      setShowModal(false);
      void loadCatalogos();
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string) {
    setConfirmDeleteId(id);
  }

  async function confirmDeleteCatalogo() {
    if (!confirmDeleteId) return;

    try {
      await request('DELETE', `/api/catalogos/${confirmDeleteId}`);
      showToast('Eliminado');
      void loadCatalogos();
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setConfirmDeleteId(null);
    }
  }

  async function handleToggle(id: string) {
    try {
      const res = await request('POST', `/api/catalogos/${id}/toggle`);
      showToast(res.data?.activo ? 'Activado' : 'Desactivado');
      void loadCatalogos();
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  }

  function copyLink(slug: string) {
    navigator.clipboard.writeText(`${window.location.origin}/c/${slug}`);
    showToast('Link copiado');
  }

  function closeModal() {
    setShowModal(false);
  }

  function removeSelectedProduct(productId: string) {
    if (includeAllProducts) return;
    setSelectedProducts((current) => current.filter((product) => product.productId !== productId));
  }

  return (
    <div className="flex-1 bg-white min-h-screen">
      <div className="max-w-[1000px] mx-auto px-6 py-10">
        <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl sm:text-4xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
              Mis Catálogos
            </h1>
            <p className="text-sm text-stone-400 font-light mt-1">Catálogos sin marca para compartir</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-wine text-white px-6 py-3 text-[11px] tracking-[0.1em] uppercase font-medium cursor-pointer hover:bg-wine-light transition-colors"
          >
            <Plus size={14} />
            Nuevo
          </button>
        </m.div>

        {loading ? (
          <div className="text-center py-24">
            <Loader2 size={32} className="animate-spin text-wine mx-auto" />
          </div>
        ) : list.length === 0 ? (
          <div className="border border-stone-200 rounded-lg p-16 text-center">
            <FileText size={48} className="text-stone-200 mx-auto mb-5" />
            <p className="text-xl text-stone-700 mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Aún no tienes catálogos
            </p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 bg-wine text-white px-8 py-3 text-[11px] tracking-[0.12em] uppercase font-medium cursor-pointer hover:bg-wine-light transition-colors mt-6"
            >
              <Plus size={14} />
              Crear
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
  {list.map((cat, i) => {
    const cfg = cat.configuracion || {};

    return (
      <m.div
        key={cat.id}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05 }}
        role="link"
        tabIndex={0}
        onClick={() => {
          window.location.href = `/c/${cat.slug}`;
        }}
        onKeyDown={(event) => {
          if (
            event.target === event.currentTarget &&
            (event.key === 'Enter' || event.key === ' ')
          ) {
            event.preventDefault();
            window.location.href = `/c/${cat.slug}`;
          }
        }}
        className="border border-stone-200 rounded-lg overflow-hidden hover:border-wine/30 hover:shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-wine/20"
      >
        <div
          className="h-2"
          style={{ background: (cfg.color_principal as string) || '#1A1A1A' }}
        />

        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-stone-800">{cat.nombre}</h3>
              <p className="text-xs text-stone-400 mt-0.5">
                {(cfg.negocio as string) || '—'}
              </p>
            </div>

            <span
              className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                cat.activo
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-stone-100 text-stone-400'
              }`}
            >
              {cat.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>

          <p className="text-xs text-stone-400 mb-4">
            {cat._count?.productos || 0} productos ·{' '}
            {new Date(cat.createdAt).toLocaleDateString('es-CO')}
          </p>

          <div className="flex items-center gap-1.5">
            <button
              onClick={(event) => {
                event.stopPropagation();
                openEdit(cat);
              }}
              className="flex-1 text-center py-2 text-xs text-wine border border-stone-200 rounded hover:border-wine/20 hover:bg-wine/5 cursor-pointer transition-colors"
            >
              Editar
            </button>

            <button
              onClick={(event) => {
                event.stopPropagation();
                copyLink(cat.slug);
              }}
              className="p-2 text-stone-400 hover:text-wine cursor-pointer"
            >
              <Copy size={14} />
            </button>

            <button
              onClick={(event) => {
                event.stopPropagation();
                handleToggle(cat.id);
              }}
              className="p-2 text-stone-400 hover:text-wine cursor-pointer"
            >
              {cat.activo ? (
                <ToggleRight size={14} className="text-emerald-500" />
              ) : (
                <ToggleLeft size={14} />
              )}
            </button>

            <button
              onClick={(event) => {
                event.stopPropagation();
                handleDelete(cat.id);
              }}
              className="p-2 text-stone-400 hover:text-red-500 cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </m.div>
    );
  })}
</div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closeModal}>
            <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40" />
            <m.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(event) => event.stopPropagation()}
            >
              <button onClick={closeModal} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 cursor-pointer z-10">
                <X size={18} />
              </button>

              <div className="p-6">
                <h2 className="text-xl font-semibold text-stone-800 mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                  {editingId ? 'Editar' : 'Nuevo'} Catálogo
                </h2>

                <div className="flex items-center gap-2 mb-6">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${step === 1 ? 'bg-wine text-white' : 'bg-stone-100 text-stone-400'}`}>
                    1. Info
                  </span>
                  <ChevronRight size={12} className="text-stone-300" />
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${step === 2 ? 'bg-wine text-white' : 'bg-stone-100 text-stone-400'}`}>
                    2. Productos
                  </span>
                </div>

               {step === 1 && (
  <div className="space-y-4">
    <div>
      <label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">
        Nombre del catálogo
      </label>
      <input
        value={form.nombre}
        onChange={(event) => setForm({ ...form, nombre: event.target.value })}
        className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-wine/30"
      />
    </div>

    <div>
      <label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">
        Nombre de tu negocio
      </label>
      <input
        value={form.negocio}
        onChange={(event) => setForm({ ...form, negocio: event.target.value })}
        className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-wine/30"
      />
    </div>

    <div className="flex items-center gap-4">
      <div>
        <label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">
          Color
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={form.color_principal}
            onChange={(event) => setForm({ ...form, color_principal: event.target.value })}
            className="w-10 h-10 rounded border border-stone-200 cursor-pointer"
          />
          <span className="text-xs text-stone-400 font-mono">
            {form.color_principal}
          </span>
        </div>
      </div>

      <div className="flex-1">
        <label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-1">
          Mostrar precios
        </label>
        <button
          type="button"
          onClick={() => setForm({ ...form, mostrar_precios: !form.mostrar_precios })}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${
            form.mostrar_precios
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-stone-200 text-stone-500'
          }`}
        >
          {form.mostrar_precios ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          <span className="text-sm">{form.mostrar_precios ? 'Sí' : 'No'}</span>
        </button>
      </div>
    </div>

    {form.mostrar_precios && (
      <div>
        <label className="block text-[10px] text-stone-500 uppercase tracking-wider mb-2">
          Precio del catálogo
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForm({ ...form, modo_precios: 'detal' })}
            className={`rounded-lg border p-3 text-left cursor-pointer ${
              form.modo_precios === 'detal' ? 'border-wine bg-wine/5' : 'border-stone-200'
            }`}
          >
            <span className="block text-sm font-medium text-stone-700">
              Precio al detal
            </span>
            <span className="text-[11px] text-stone-400">
              Usar el publicado en la tienda
            </span>
          </button>

          <button
            type="button"
            onClick={() => setForm({ ...form, modo_precios: 'personalizado' })}
            className={`rounded-lg border p-3 text-left cursor-pointer ${
              form.modo_precios === 'personalizado' ? 'border-wine bg-wine/5' : 'border-stone-200'
            }`}
          >
            <span className="block text-sm font-medium text-stone-700">
              Precio personalizado
            </span>
            <span className="text-[11px] text-stone-400">
              Editar cada producto
            </span>
          </button>
        </div>
      </div>
    )}

    <button
      onClick={() => setStep(2)}
      disabled={!form.nombre || !form.negocio}
      className="w-full bg-wine text-white py-3 rounded-lg text-sm font-semibold uppercase tracking-wider cursor-pointer hover:bg-wine-light transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
    >
      Siguiente <ChevronRight size={14} />
    </button>
  </div>
)}

                {step === 2 && (
                  <div>
                    <div className="flex gap-3 mb-4">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                          placeholder="Buscar por nombre o SKU"
                          value={searchInput}
                          onChange={(event) => setSearchInput(event.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-300"
                        />
                      </div>

                      <select
                        value={categoryFilter}
                        onChange={(event) => setCategoryFilter(event.target.value)}
                        className="px-3 py-2 border border-stone-200 rounded-lg text-sm cursor-pointer focus:outline-none"
                      >
                        <option value="all">Todas</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    {!editingId && (
                      <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50/70 p-3">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={includeAllProducts}
                            onChange={(event) => setIncludeAllProducts(event.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-stone-300 text-wine focus:ring-wine/20"
                          />
                          <div>
                            <p className="text-sm font-medium text-stone-700">Seleccionar todos los productos</p>
                            <p className="mt-1 text-xs text-stone-500">
                              Se incluirán todos los productos activos disponibles.
                            </p>
                          </div>
                        </label>

                        {includeAllProducts && (
                          <div className="mt-3 rounded-lg border border-gold/20 bg-gold/[0.06] px-3 py-2">
                            <p className="text-xs text-stone-600">
                              Esta opción incluirá todos los productos activos, incluso los que no ves en esta página.
                            </p>
                            <p className="mt-1 text-xs font-medium text-stone-700">
                              Se incluirán {productMeta.activeTotal ?? productMeta.total} productos activos.
                            </p>
                            {selectedProducts.length > 0 && (
                              <p className="mt-1 text-[11px] text-stone-500">
                                Tus {selectedProducts.length} selecciones manuales se conservarán si desactivas esta opción.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mb-3 flex items-center justify-between text-[11px] text-stone-500">
                      <span>
                        {includeAllProducts
                          ? 'Todos los productos activos serán incluidos'
                          : `${selectedProducts.length} productos seleccionados`}
                      </span>
                      <span>
                        {includeAllProducts
                          ? `Se incluirán ${productMeta.activeTotal ?? productMeta.total} productos activos`
                          : `Mostrando ${productOptions.length} de ${productMeta.total}`}
                      </span>
                    </div>

                    {!includeAllProducts && selectedProducts.length > 0 && (
                      <div className="bg-ivory rounded-lg p-3 mb-4">
                        <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold mb-2">
                          Selección actual
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedProducts.map((selected) => (
                            <span
                              key={selected.productId}
                              className="inline-flex items-center gap-1 text-[10px] bg-white border border-stone-200 px-2 py-1 rounded"
                            >
                              {selected.nombre}
                              <button
                                onClick={() => removeSelectedProduct(selected.productId)}
                                className="text-stone-400 hover:text-red-500 cursor-pointer"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="max-h-[40vh] overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100">
                      {productLoading ? (
                        <div className="py-12 text-center">
                          <Loader2 size={22} className="animate-spin text-wine mx-auto" />
                        </div>
                      ) : productOptions.length === 0 ? (
                        <div className="px-6 py-10 text-center">
                          <p className="text-sm text-stone-600">No encontramos productos con esos filtros.</p>
                          <p className="mt-1 text-xs text-stone-400">Prueba otra búsqueda o cambia la categoría.</p>
                        </div>
                      ) : (
                        productOptions.map((product) => {
                          const isSelected = selectedIds.has(product.id);
                          const productImage = product.imagenes?.[0] || null;

                          return (
                            <div
                              key={product.id}
                              className={`flex items-center gap-3 px-4 py-3 ${
                                includeAllProducts
                                  ? 'opacity-70'
                                  : isSelected
                                    ? 'bg-wine/[0.03]'
                                    : 'hover:bg-stone-50'
                              }`}
                            >
                              <button
                                onClick={() => toggleProduct(product)}
                                disabled={includeAllProducts}
                                className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                                  includeAllProducts
                                    ? 'cursor-not-allowed border-stone-200 bg-stone-100 text-stone-300'
                                    : isSelected
                                      ? 'bg-wine border-wine text-white cursor-pointer'
                                      : 'border-stone-300 cursor-pointer'
                                }`}
                              >
                                {isSelected && <Check size={12} />}
                              </button>

                              {productImage ? (
                                <Image
                                  src={productImage}
                                  alt=""
                                  width={40}
                                  height={40}
                                  className="object-cover rounded bg-stone-100 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded bg-stone-100 flex-shrink-0" />
                              )}

                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-stone-700 truncate">{product.nombre}</p>
                                <p className="text-[10px] text-stone-400 truncate">
                                  {product.sku} · {product.categoria?.nombre || 'Sin categoría'}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {productMeta.hasNextPage && (
                      <div className="mt-3 flex justify-center">
                        <button
                          onClick={() => void loadSelectableProducts(productMeta.page + 1, true)}
                          disabled={productLoadingMore}
                          className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
                        >
                          {productLoadingMore && <Loader2 size={14} className="animate-spin" />}
                          {productLoadingMore ? 'Cargando...' : 'Cargar más productos'}
                        </button>
                      </div>
                    )}

                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => setStep(1)}
                        className="flex-1 py-3 border border-stone-200 rounded-lg text-sm text-stone-600 cursor-pointer hover:bg-stone-50"
                      >
                        ← Atrás
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving || (!editingId && !includeAllProducts && selectedProducts.length === 0)}
                        className="flex-1 bg-wine text-white py-3 rounded-lg text-sm font-semibold uppercase tracking-wider cursor-pointer hover:bg-wine-light disabled:opacity-40 flex items-center justify-center gap-2"
                      >
                        {saving && <Loader2 size={14} className="animate-spin" />}
                        {editingId ? 'Guardar' : 'Crear'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </m.div>
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
