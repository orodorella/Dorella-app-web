'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
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

  useEffect(() => {
    if (!lightboxOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [lightboxOpen]);

  function handleAddToCart() {
    addToCart([{ product, cantidad }]);
    showToast(`${product.nombre} x${cantidad} agregado al carrito`);
  }

  const whatsappMsg = encodeURIComponent(`Hola, me interesa: ${product.nombre} (${product.ref}) - ${formatCOP(product.precio)}`);

  const accordions = [
    { key: 'garantia', title: 'Garantía', content: 'Todas nuestras piezas cuentan con garantía por cambio de tonalidad. Si el color de tu joya cambia, la reemplazamos sin costo adicional.' },
    { key: 'envio', title: 'Envío', content: 'Envíos a toda Colombia por TCC o Servientrega. Tiempo estimado: 3-5 días hábiles. Pedidos superiores a $500.000 con envío gratuito.' },
    { key: 'cuidados', title: 'Cuidados del producto', content: 'Evitar contacto con perfumes, cremas y productos químicos. Guardar en lugar seco. Limpiar con paño suave y seco.' },
  ];

  return (
    <div className="flex-1 bg-white min-h-screen">
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <Link href="/catalogo" className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-stone-600 transition-colors cursor-pointer mb-8">
          <ArrowLeft size={16} /> Catálogo
        </Link>

        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-16">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            {product.imagen ? (
              <button type="button" onClick={() => setLightboxOpen(true)}
                className="group relative aspect-square w-full bg-stone-50 overflow-hidden cursor-zoom-in">
                <Image src={product.imagen} alt={product.nombre} fill sizes="100vw" className="object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100">
                  <span className="bg-white/90 backdrop-blur-sm text-stone-700 text-[10px] uppercase tracking-[0.1em] font-medium px-4 py-2 flex items-center gap-1.5">
                    <ZoomIn size={12} /> Ampliar imagen
                  </span>
                </div>
              </button>
            ) : (
              <div className="aspect-square bg-gradient-to-br from-stone-100 to-stone-50 flex items-center justify-center">
                <span className="text-stone-300 text-lg" style={{ fontFamily: 'var(--font-display)' }}>{product.ref}</span>
              </div>
            )}
          </motion.div>

          <AnimatePresence>
            {lightboxOpen && product.imagen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                onClick={() => setLightboxOpen(false)}
                className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 cursor-zoom-out">
                <button type="button" onClick={() => setLightboxOpen(false)} aria-label="Cerrar"
                  className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors cursor-pointer">
                  <X size={28} />
                </button>
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-full max-w-3xl aspect-square">
                  <Image src={product.imagen} alt={product.nombre} fill sizes="100vw" className="object-contain" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <p className="font-functional text-[10px] text-stone-400 uppercase tracking-[0.2em] mb-2">{product.ref}</p>
            <h1 className="text-3xl sm:text-4xl text-stone-800 mb-3" style={{ fontFamily: 'var(--font-display)' }}>{product.nombre}</h1>
            <p className="text-xs text-stone-400 uppercase tracking-[0.15em] mb-6">{product.material}</p>

            <div className="mb-8 pb-8 border-b border-stone-100">
              <div className="flex items-baseline gap-3" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <span className="text-2xl font-semibold text-wine" style={{ fontFamily: 'var(--font-display)' }}>{formatCOP(product.precio)}</span>
                {tierInfo.descuento > 0 && <span className="text-xs text-wine/50">-{(tierInfo.descuento * 100).toFixed(1)}%</span>}
              </div>
            </div>

            <p className="text-sm text-stone-500 leading-relaxed font-light mb-8">{product.descripcion}</p>

            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center border border-stone-200">
                <button onClick={() => setCantidad(Math.max(1, cantidad - 1))} className="w-10 h-10 flex items-center justify-center hover:bg-stone-50 cursor-pointer transition-colors"><Minus size={14} /></button>
                <input type="number" min="1" max={product.stock} value={cantidad}
                  onChange={(e) => setCantidad(Math.max(1, Math.min(parseInt(e.target.value) || 1, product.stock)))}
                  className="w-14 h-10 text-center text-sm border-x border-stone-200 focus:outline-none" style={{ fontVariantNumeric: 'tabular-nums' }} />
                <button onClick={() => setCantidad(Math.min(product.stock, cantidad + 1))} className="w-10 h-10 flex items-center justify-center hover:bg-stone-50 cursor-pointer transition-colors"><Plus size={14} /></button>
              </div>
              <span className="text-xs text-stone-400">{product.stock} disponibles</span>
            </div>

            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleAddToCart}
              className="w-full bg-wine text-white py-4 font-semibold text-[11px] uppercase tracking-[0.2em] hover:bg-wine-light cursor-pointer flex items-center justify-center gap-2 transition-colors mb-3">
              <ShoppingBag size={16} /> Agregar al carrito
            </motion.button>

            <a href={`https://wa.me/573000000000?text=${whatsappMsg}`} target="_blank" rel="noopener noreferrer"
              className="w-full border border-stone-200 text-stone-600 py-3.5 font-medium text-[11px] uppercase tracking-[0.15em] hover:border-stone-400 cursor-pointer flex items-center justify-center gap-2 transition-colors">
              <MessageCircle size={16} /> Comprar por WhatsApp
            </a>

            <div className="mt-10 border-t border-stone-100">
              {accordions.map((a) => (
                <div key={a.key} className="border-b border-stone-100">
                  <button onClick={() => setOpenSection(openSection === a.key ? null : a.key)}
                    className="w-full flex items-center justify-between py-4 text-sm text-stone-700 cursor-pointer hover:text-stone-900 transition-colors">
                    <span className="uppercase tracking-[0.1em] text-[11px] font-medium">{a.title}</span>
                    <ChevronDown size={16} className={`text-stone-400 transition-transform duration-300 ${openSection === a.key ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {openSection === a.key && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                        <p className="text-sm text-stone-400 font-light leading-relaxed pb-4">{a.content}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {relacionados.length > 0 && (
          <section className="mt-24 mb-8">
            <h2 className="text-2xl text-stone-800 mb-10 text-center" style={{ fontFamily: 'var(--font-display)' }}>También te puede interesar</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {relacionados.map((p) => (
                <Link key={p.id} href={`/producto/${p.id}`} className="group cursor-pointer block">
                  <div className="relative aspect-square bg-stone-50 overflow-hidden mb-3">
                    {p.imagen && <Image src={p.imagen} alt={p.nombre} fill sizes="(max-width:768px) 50vw, 20vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />}
                  </div>
                  <p className="text-[11px] text-stone-700 uppercase tracking-[0.05em] group-hover:text-wine transition-colors">{p.nombre}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{p.material}</p>
                  <p className="text-sm font-semibold text-stone-800 mt-1 font-functional">{formatCOP(p.precio)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
