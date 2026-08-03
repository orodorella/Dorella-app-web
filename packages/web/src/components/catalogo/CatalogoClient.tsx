'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, Filter, ShoppingBag, Plus, Check, ArrowUp, Grid3x3, List, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthProvider';
import { useCart } from '@/context/CartProvider';
import { useToast } from '@/context/ToastProvider';
import { formatCOP } from '@/lib/api-client';

interface CatProduct {
  id: string;
  ref: string;
  nombre: string;
  precio: number;
  precioPublico: number;
  imagen: string | null;
  material: string;
  stock: number;
  categoria: string;
  categoriaSlug: string;
}

interface Props {
  initialProducts: CatProduct[];
  categories: Array<{ id: string; nombre: string; slug: string }>;
  initialCategorySlug?: string;
}

export default function CatalogoClient({ initialProducts, categories, initialCategorySlug = '' }: Props) {
  const { tierInfo } = useAuth();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [busqueda, setBusqueda] = useState('');
  const initialCategory = useMemo(
    () => categories.find((category) => category.slug === initialCategorySlug)?.slug || 'Todas',
    [categories, initialCategorySlug],
  );
  const [categoriaFiltro, setCategoriaFiltro] = useState(initialCategory);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [agregados, setAgregados] = useState<Set<string>>(new Set());
  const [vista, setVista] = useState<'grid' | 'list'>('grid');

  const filtrados = initialProducts.filter((p) => {
    const matchBusqueda =
      !busqueda ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.ref.toLowerCase().includes(busqueda.toLowerCase());
    const matchCat = categoriaFiltro === 'Todas' || p.categoriaSlug === categoriaFiltro;
    return matchBusqueda && matchCat;
  });

  function setCantidad(id: string, val: string) {
    const product = initialProducts.find((p) => p.id === id);
    if (!product || product.stock <= 0) {
      setCantidades((prev) => ({ ...prev, [id]: 0 }));
      return;
    }

    const num = Math.max(0, Math.min(parseInt(val) || 0, product.stock));
    setCantidades((prev) => ({ ...prev, [id]: num }));
    if (num > 0) setSeleccionados((prev) => new Set(prev).add(id));
  }

  function agregarUno(product: CatProduct) {
    const isOutOfStock = product.stock <= 0;
    if (isOutOfStock) return;

    const cant = cantidades[product.id] || 1;
    addToCart([{ product: { ...product, id: product.id }, cantidad: cant }]);
    showToast(`${product.nombre} x${cant} agregado`);
    setCantidades((prev) => ({ ...prev, [product.id]: 0 }));
    setAgregados((prev) => new Set(prev).add(product.id));
    setTimeout(
      () =>
        setAgregados((prev) => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        }),
      1500,
    );
  }

  function agregarLote() {
    const items: Array<{ product: CatProduct; cantidad: number }> = [];
    for (const id of seleccionados) {
      const cant = cantidades[id] || 1;
      if (cant <= 0) continue;
      const product = initialProducts.find((p) => p.id === id);
      if (product && product.stock > 0) items.push({ product, cantidad: cant });
    }
    if (items.length === 0) return;
    addToCart(items);
    const totalPcs = items.reduce((sum, item) => sum + item.cantidad, 0);
    showToast(`${items.length} referencia(s) — ${totalPcs} piezas agregadas`);
    setCantidades({});
    setSeleccionados(new Set());
    const ids = new Set(items.map((item) => item.product.id));
    setAgregados(ids);
    setTimeout(() => setAgregados(new Set()), 1500);
  }

  function toggleSeleccion(id: string) {
    const product = initialProducts.find((p) => p.id === id);
    if (!product || product.stock <= 0) return;

    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        if (!cantidades[id]) setCantidades((current) => ({ ...current, [id]: 1 }));
      }
      return next;
    });
  }

  const haySeleccionConCantidad = [...seleccionados].some((id) => {
    const product = initialProducts.find((p) => p.id === id);
    return Boolean(product && product.stock > 0 && (cantidades[id] || 0) > 0);
  });

  return (
    <div className="flex-1 min-h-screen bg-white">
      <div className="mx-auto max-w-[1200px] px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"
        >
          <div>
            <h1 className="editorial-title text-[clamp(2rem,5vw,3.2rem)] text-stone-800">Catálogo</h1>
            <p className="mt-2 text-[13px] font-light tracking-wide text-stone-400">
              {filtrados.length} referencias
              {tierInfo.descuento > 0 && (
                <span className="ml-2 text-gold">
                  — Precio {tierInfo.label} ({(tierInfo.descuento * 100).toFixed(1)}% dto.)
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden border border-stone-200">
              <button
                onClick={() => setVista('grid')}
                className={`cursor-pointer p-2.5 transition-colors ${
                  vista === 'grid' ? 'bg-wine text-white' : 'text-stone-400 hover:text-stone-600'
                }`}
                aria-label="Vista cuadrícula"
              >
                <Grid3x3 size={16} />
              </button>
              <button
                onClick={() => setVista('list')}
                className={`cursor-pointer p-2.5 transition-colors ${
                  vista === 'list' ? 'bg-wine text-white' : 'text-stone-400 hover:text-stone-600'
                }`}
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
                  className="flex cursor-pointer items-center gap-2 bg-wine px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-wine-light"
                >
                  <ShoppingBag size={14} /> Agregar {seleccionados.size} ref.
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <div className="mb-8 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o referencia..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm text-stone-800 placeholder:text-stone-400 transition-colors focus:border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-200"
            />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="cursor-pointer appearance-none border border-stone-200 bg-white py-3 pl-10 pr-8 text-sm text-stone-600 focus:border-stone-300 focus:outline-none"
            >
              <option value="Todas">Todas las categorías</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-lg text-stone-500" style={{ fontFamily: 'var(--font-display)' }}>
              No se encontraron productos
            </p>
            <p className="mt-1 text-sm text-stone-400">Intenta con otra búsqueda o categoría</p>
          </div>
        ) : vista === 'grid' ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {filtrados.map((p, idx) => {
              const justAdded = agregados.has(p.id);
              const isOutOfStock = p.stock <= 0;

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.4) }}
                  className={`group relative ${justAdded ? 'ring-2 ring-emerald-300 ring-offset-2' : ''}`}
                >
                  <Link href={`/producto/${p.id}`} className="block cursor-pointer">
                    <div className="relative mb-3 aspect-square overflow-hidden bg-stone-50">
                      {p.imagen ? (
                        <Image
                          src={p.imagen}
                          alt={p.nombre}
                          fill
                          sizes="(max-width:768px) 50vw, 25vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-50">
                          <span className="text-sm text-stone-300" style={{ fontFamily: 'var(--font-display)' }}>
                            {p.ref}
                          </span>
                        </div>
                      )}

                      {isOutOfStock && (
                        <div className="absolute left-3 top-3 bg-white/92 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-wine backdrop-blur-sm">
                          Agotado
                        </div>
                      )}

                      <div className="absolute inset-0 flex items-end justify-center bg-black/0 pb-4 opacity-0 transition-colors duration-300 group-hover:bg-black/5 group-hover:opacity-100">
                        <span className="flex items-center gap-1.5 bg-white/90 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-stone-700 backdrop-blur-sm">
                          <Eye size={12} /> Ver detalle
                        </span>
                      </div>
                    </div>
                  </Link>
                  <p className="product-name text-[12px] uppercase text-stone-700">{p.nombre}</p>
                  <p className="mt-0.5 text-[10px] font-light tracking-wide text-stone-400">{p.material}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="flex items-baseline gap-1.5">
                      {p.precioPublico > p.precio && (
                        <span className="font-functional text-[11px] text-stone-400 line-through">
                          {formatCOP(p.precioPublico)}
                        </span>
                      )}
                      <span className="font-functional font-semibold text-stone-800">{formatCOP(p.precio)}</span>
                    </span>
                    <motion.button
                      whileTap={isOutOfStock ? undefined : { scale: 0.9 }}
                      onClick={(e) => {
                        e.preventDefault();
                        if (isOutOfStock) return;
                        agregarUno(p);
                      }}
                      disabled={isOutOfStock}
                      aria-disabled={isOutOfStock}
                      className={`p-1.5 transition-colors ${
                        isOutOfStock
                          ? 'cursor-not-allowed text-stone-300 opacity-55'
                          : justAdded
                            ? 'cursor-pointer text-emerald-500'
                            : 'cursor-pointer text-stone-300 hover:text-wine'
                      }`}
                      aria-label={isOutOfStock ? `${p.nombre} agotado` : `Agregar ${p.nombre}`}
                    >
                      {justAdded ? <Check size={16} /> : <Plus size={16} />}
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden border border-stone-200">
            <div className="hidden grid-cols-[40px_56px_1fr_110px_80px_80px_80px] items-center gap-4 border-b border-stone-200 px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-400 sm:grid">
              <div></div>
              <div></div>
              <div>Producto</div>
              <div className="text-right">Precio</div>
              <div className="text-center">Stock</div>
              <div className="text-center">Cant.</div>
              <div></div>
            </div>
            {filtrados.map((p) => {
              const isSelected = seleccionados.has(p.id);
              const justAdded = agregados.has(p.id);
              const isOutOfStock = p.stock <= 0;

              return (
                <div
                  key={p.id}
                  className={`grid grid-cols-[1fr_auto] items-center gap-4 border-b border-stone-100 px-5 py-3.5 transition-colors sm:grid-cols-[40px_56px_1fr_110px_80px_80px_80px] ${
                    isSelected ? 'bg-wine/[0.03]' : 'hover:bg-stone-50'
                  } ${justAdded ? 'bg-emerald-50' : ''}`}
                >
                  <div className="hidden sm:flex">
                    <button
                      onClick={() => toggleSeleccion(p.id)}
                      disabled={isOutOfStock}
                      className={`flex h-5 w-5 items-center justify-center rounded border transition-all ${
                        isOutOfStock
                          ? 'cursor-not-allowed border-stone-200 bg-stone-50 opacity-50'
                          : isSelected
                            ? 'border-wine bg-wine text-white'
                            : 'cursor-pointer border-stone-300 hover:border-stone-400'
                      }`}
                    >
                      {isSelected && <Check size={11} />}
                    </button>
                  </div>
                  <div className="hidden sm:block">
                    {p.imagen ? (
                      <Image src={p.imagen} alt="" width={56} height={56} className="rounded bg-stone-50 object-cover" />
                    ) : (
                      <div className="h-14 w-14 bg-stone-50" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/producto/${p.id}`}
                      className="block truncate text-[13px] font-semibold tracking-wide text-stone-800 transition-colors hover:text-wine"
                    >
                      {p.nombre}
                    </Link>
                    <p className="font-functional text-[10px] tracking-wider text-stone-400">
                      {p.ref} · {p.categoria}
                    </p>
                  </div>
                  <div className="text-right font-functional">
                    {p.precioPublico > p.precio && (
                      <div className="text-[10px] text-stone-400 line-through">{formatCOP(p.precioPublico)}</div>
                    )}
                    <div className="font-semibold text-stone-800">{formatCOP(p.precio)}</div>
                  </div>
                  <div className="hidden text-center sm:block">
                    <span
                      className={`text-[11px] font-medium ${
                        isOutOfStock ? 'text-wine' : p.stock > 50 ? 'text-emerald-600' : p.stock > 10 ? 'text-amber-600' : 'text-red-600'
                      }`}
                    >
                      {isOutOfStock ? 'Agotado' : `${p.stock} uds`}
                    </span>
                  </div>
                  <div className="hidden justify-center sm:flex">
                    <input
                      type="number"
                      min="0"
                      max={p.stock}
                      value={cantidades[p.id] || ''}
                      disabled={isOutOfStock}
                      onChange={(e) => setCantidad(p.id, e.target.value)}
                      onFocus={() => {
                        if (isOutOfStock) return;
                        if (!cantidades[p.id]) setCantidad(p.id, '1');
                      }}
                      placeholder="0"
                      className={`w-16 border py-1.5 text-center text-sm focus:outline-none ${
                        isOutOfStock
                          ? 'cursor-not-allowed border-stone-200 bg-stone-50 text-stone-400 opacity-60'
                          : 'border-stone-200 bg-white focus:border-stone-300'
                      }`}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>
                  <div className="hidden justify-center sm:flex">
                    {justAdded ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <Check size={14} /> Listo
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          if (isOutOfStock) return;
                          agregarUno(p);
                        }}
                        disabled={isOutOfStock}
                        aria-disabled={isOutOfStock}
                        className={`px-2 py-1.5 text-xs transition-colors ${
                          isOutOfStock
                            ? 'cursor-not-allowed text-stone-300 opacity-55'
                            : 'cursor-pointer text-wine/40 hover:bg-wine/5 hover:text-wine'
                        }`}
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:hidden">
                    <input
                      type="number"
                      min="0"
                      max={p.stock}
                      value={cantidades[p.id] || ''}
                      disabled={isOutOfStock}
                      onChange={(e) => setCantidad(p.id, e.target.value)}
                      placeholder="0"
                      className={`w-14 border py-1.5 text-center text-sm ${
                        isOutOfStock
                          ? 'cursor-not-allowed border-stone-200 bg-stone-50 text-stone-400 opacity-60'
                          : 'border-stone-200 bg-white'
                      }`}
                    />
                    <button
                      onClick={() => {
                        if (isOutOfStock) return;
                        agregarUno(p);
                      }}
                      disabled={isOutOfStock}
                      aria-disabled={isOutOfStock}
                      className={`p-2.5 ${
                        isOutOfStock
                          ? 'cursor-not-allowed bg-stone-200 text-stone-400 opacity-60'
                          : 'cursor-pointer bg-wine text-white'
                      }`}
                    >
                      {justAdded ? <Check size={14} /> : <Plus size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <AnimatePresence>
          {haySeleccionConCantidad && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2"
            >
              <button
                onClick={agregarLote}
                className="flex cursor-pointer items-center gap-3 rounded-full bg-wine px-10 py-4 text-sm font-semibold uppercase tracking-[0.1em] text-white shadow-xl transition-colors hover:bg-wine-light"
              >
                <ShoppingBag size={18} /> Agregar {seleccionados.size} ref. al carrito <ArrowUp size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
