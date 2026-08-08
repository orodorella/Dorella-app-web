'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { m, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Minus, Plus, ChevronDown, MessageCircle, ArrowLeft, ZoomIn, X } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useCart } from '@/context/CartProvider';
import { useToast } from '@/context/ToastProvider';
import { formatCOP } from '@/lib/api-client';

interface ProductData {
  id: string;
  ref: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  precioPublico: number;
  imagen: string | null;
  imagenes: string[];
  material: string | null;
  stock: number;
  categoria: string;
  categoriaSlug: string;
}

interface Props {
  product: ProductData;
  relacionados: ProductData[];
}

export default function ProductClient({ product, relacionados }: Props) {
  const { tierInfo } = useAuth();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [cantidad, setCantidad] = useState(1);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const isOutOfStock = product.stock <= 0;
  const whatsappMsg = encodeURIComponent(
    `Hola! Estoy interesada en este producto: ${product.nombre}. ¿Me pueden dar más información?`
  );

  useEffect(() => {
    if (!lightboxOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [lightboxOpen]);

  function handleAddToCart() {
    if (isOutOfStock) return;
    addToCart([{ product, cantidad }]);
    showToast(`${product.nombre} x${cantidad} agregado al carrito`);
  }

  const accordions = [
    {
      key: 'garantia',
      title: 'Garantía',
      content:
        'Todas nuestras piezas cuentan con garantía por cambio de tonalidad. Si el color de tu joya cambia, la reemplazamos sin costo adicional.',
    },
    {
      key: 'envio',
      title: 'Envío',
      content:
        'Envíos nacionales e internacionales por transportadoras aliadas. El tiempo estimado depende del destino y la logística de entrega.',
    },
    {
      key: 'cuidados',
      title: 'Cuidados del producto',
      content:
        'Evitar contacto con perfumes, cremas y productos químicos. Guardar en lugar seco. Limpiar con paño suave y seco.',
    },
  ];

  return (
    <div className="flex-1 min-h-screen bg-white">
      <div className="mx-auto max-w-[1200px] px-6 py-8">
        <Link
          href="/catalogo"
          className="mb-8 inline-flex cursor-pointer items-center gap-2 text-sm text-stone-400 transition-colors hover:text-stone-600"
        >
          <ArrowLeft size={16} /> Catálogo
        </Link>

        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            {product.imagen ? (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="group relative aspect-square w-full cursor-zoom-in overflow-hidden bg-stone-50"
              >
                <Image src={product.imagen} alt={product.nombre} fill sizes="100vw" className="object-cover" />
                <div className="absolute inset-0 flex items-end justify-center bg-black/0 pb-4 opacity-0 transition-colors duration-300 group-hover:bg-black/5 group-hover:opacity-100">
                  <span className="flex items-center gap-1.5 bg-white/90 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-stone-700 backdrop-blur-sm">
                    <ZoomIn size={12} /> Ampliar imagen
                  </span>
                </div>
              </button>
            ) : (
              <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-stone-100 to-stone-50">
                <span className="text-lg text-stone-300" style={{ fontFamily: 'var(--font-display)' }}>
                  {product.ref}
                </span>
              </div>
            )}
          </m.div>

          <AnimatePresence>
            {lightboxOpen && product.imagen && (
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setLightboxOpen(false)}
                className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/90 p-6"
              >
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  aria-label="Cerrar"
                  className="absolute right-6 top-6 cursor-pointer text-white/70 transition-colors hover:text-white"
                >
                  <X size={28} />
                </button>
                <m.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative aspect-square w-full max-w-3xl"
                >
                  <Image src={product.imagen} alt={product.nombre} fill sizes="100vw" className="object-contain" />
                </m.div>
              </m.div>
            )}
          </AnimatePresence>

          <m.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <p className="mb-2 font-functional text-[10px] uppercase tracking-[0.2em] text-stone-400">{product.ref}</p>
            <h1 className="mb-3 text-3xl text-stone-800 sm:text-4xl" style={{ fontFamily: 'var(--font-display)' }}>
              {product.nombre}
            </h1>
            <p className="mb-6 text-xs uppercase tracking-[0.15em] text-stone-400">{product.material}</p>

            <div className="mb-8 border-b border-stone-100 pb-8">
              <div className="flex items-baseline gap-3" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {product.precioPublico > product.precio && (
                  <span className="text-base text-stone-400 line-through">{formatCOP(product.precioPublico)}</span>
                )}
                <span className="text-2xl font-semibold text-wine" style={{ fontFamily: 'var(--font-display)' }}>
                  {formatCOP(product.precio)}
                </span>
                {tierInfo.descuento > 0 && (
                  <span className="text-xs text-wine/50">-{(tierInfo.descuento * 100).toFixed(1)}%</span>
                )}
              </div>
            </div>

            <p className="mb-8 text-sm font-light leading-relaxed text-stone-500">{product.descripcion}</p>

            <div className="mb-4">
              <div className="flex items-center gap-4">
                <div
                  className={`flex items-center border border-stone-200 transition-opacity ${
                    isOutOfStock ? 'opacity-50' : ''
                  }`}
                >
                  <button
                    onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                    disabled={isOutOfStock}
                    className={`flex h-10 w-10 items-center justify-center transition-colors ${
                      isOutOfStock ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-stone-50'
                    }`}
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={Math.max(1, product.stock)}
                    value={cantidad}
                    disabled={isOutOfStock}
                    onChange={(e) =>
                      setCantidad(Math.max(1, Math.min(parseInt(e.target.value) || 1, Math.max(1, product.stock))))
                    }
                    className={`h-10 w-14 border-x border-stone-200 text-center text-sm focus:outline-none ${
                      isOutOfStock ? 'cursor-not-allowed bg-stone-50 text-stone-400' : ''
                    }`}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  />
                  <button
                    onClick={() => setCantidad(Math.min(product.stock, cantidad + 1))}
                    disabled={isOutOfStock}
                    className={`flex h-10 w-10 items-center justify-center transition-colors ${
                      isOutOfStock ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-stone-50'
                    }`}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {isOutOfStock ? (
                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-wine">Agotado</span>
                ) : (
                  <span className="text-xs text-stone-400">{product.stock} disponibles</span>
                )}
              </div>

              {isOutOfStock && (
                <p className="mt-2 text-xs font-light text-wine/80">Esta pieza no está disponible por el momento.</p>
              )}
            </div>

            <m.button
              whileHover={isOutOfStock ? undefined : { scale: 1.01 }}
              whileTap={isOutOfStock ? undefined : { scale: 0.98 }}
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className={`mb-3 flex w-full items-center justify-center gap-2 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors ${
                isOutOfStock
                  ? 'cursor-not-allowed bg-wine/45 text-white/85 opacity-70'
                  : 'cursor-pointer bg-wine text-white hover:bg-wine-light'
              }`}
            >
              <ShoppingBag size={16} /> Agregar al carrito
            </m.button>

            <a
              href={isOutOfStock ? undefined : `https://wa.me/573156343383?text=${whatsappMsg}`}
              target={isOutOfStock ? undefined : '_blank'}
              rel={isOutOfStock ? undefined : 'noopener noreferrer'}
              onClick={(e) => {
                if (isOutOfStock) e.preventDefault();
              }}
              aria-disabled={isOutOfStock}
              className={`flex w-full items-center justify-center gap-2 border py-3.5 text-[11px] font-medium uppercase tracking-[0.15em] transition-colors ${
                isOutOfStock
                  ? 'cursor-not-allowed border-stone-200 text-stone-400 opacity-60'
                  : 'cursor-pointer border-stone-200 text-stone-600 hover:border-stone-400'
              }`}
            >
              <MessageCircle size={16} /> Comprar por WhatsApp
            </a>

            <div className="mt-10 border-t border-stone-100">
              {accordions.map((a) => (
                <div key={a.key} className="border-b border-stone-100">
                  <button
                    onClick={() => setOpenSection(openSection === a.key ? null : a.key)}
                    className="flex w-full cursor-pointer items-center justify-between py-4 text-sm text-stone-700 transition-colors hover:text-stone-900"
                  >
                    <span className="text-[11px] font-medium uppercase tracking-[0.1em]">{a.title}</span>
                    <ChevronDown
                      size={16}
                      className={`text-stone-400 transition-transform duration-300 ${
                        openSection === a.key ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {openSection === a.key && (
                      <m.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <p className="pb-4 text-sm font-light leading-relaxed text-stone-400">{a.content}</p>
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </m.div>
        </div>

        {relacionados.length > 0 && (
          <section className="mb-8 mt-24">
            <h2 className="mb-10 text-center text-2xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
              También te puede interesar
            </h2>
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              {relacionados.map((p) => (
                <Link key={p.id} href={`/producto/${p.id}`} className="group block cursor-pointer">
                  <div className="relative mb-3 aspect-square overflow-hidden bg-stone-50">
                    {p.imagen && (
                      <Image
                        src={p.imagen}
                        alt={p.nombre}
                        fill
                        sizes="(max-width:768px) 50vw, 20vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.05em] text-stone-700 transition-colors group-hover:text-wine">
                    {p.nombre}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-400">{p.material}</p>
                  <p className="mt-1 font-functional text-sm font-semibold text-stone-800">{formatCOP(p.precio)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
