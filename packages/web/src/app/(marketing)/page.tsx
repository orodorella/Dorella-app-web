import Image from 'next/image';
import { serverFetch, formatCOP } from '@/lib/api-client';
import HomeHero from '@/components/marketing/HomeHero';
import Link from 'next/link';
import { mockCategories } from '@/mocks/categories';
import { mockProducts } from '@/mocks/products';

export const revalidate = 60;

interface Product {
  id: string;
  sku: string;
  nombre: string;
  precio: number;
  imagenes: string[];
  material: string;
}

interface Category {
  id: string;
  nombre: string;
  slug: string;
}

export default async function Home() {
  let featured: Product[] = [];
  let categories: Category[] = [];
  try {
    const [fRes, cRes] = await Promise.all([
      serverFetch<Product[]>('/api/products/featured'),
      serverFetch<Category[]>('/api/categories'),
    ]);
    if (fRes.success) featured = fRes.data;
    if (cRes.success) categories = cRes.data;
  } catch { /* API not available */ }

  if (featured.length === 0) {
    featured = mockProducts.filter((product) => product.isFeatured);
  }

  if (categories.length === 0) {
    categories = mockCategories;
  }

  return (
    <div className="flex-1">
      <HomeHero />

      {/* Stats Bar */}
      <section className="border-y border-stone-100 bg-white">
        <div className="max-w-[1000px] mx-auto px-6 py-14 flex flex-col sm:flex-row items-center justify-center gap-10 sm:gap-0">
          {[
            { value: '30 micras', label: 'de oro 18k' },
            { value: 'Más de 500', label: 'referencias' },
            { value: 'Hasta 37.5%', label: 'en compras mayoristas' },
          ].map((stat, i) => (
            <div key={stat.label} className={`text-center flex-1 ${i > 0 ? 'sm:border-l sm:border-stone-100' : ''}`}>
              <p className="text-[1.8rem] text-stone-800" style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, letterSpacing: '-0.02em' }}>
                {stat.value}
              </p>
              <p className="text-[10px] text-stone-400 uppercase tracking-[0.25em] mt-2 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Products — SSR from API */}
      {featured.length > 0 && (
        <section className="max-w-[1200px] mx-auto px-6 py-24 sm:py-32">
          <div className="text-center mb-16">
            <p className="text-[10px] text-gold uppercase tracking-[0.4em] mb-4 font-medium">Selección</p>
            <h2 className="text-[clamp(2rem,4vw,3.2rem)] text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
              Piezas Destacadas
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-7">
            {featured.slice(0, 4).map((item) => (
              <Link key={item.id} href={`/producto/${item.id}`} className="group cursor-pointer block">
                <div className="relative aspect-square overflow-hidden bg-stone-50 mb-5">
                  {item.imagenes?.[0] ? (
                    <Image src={item.imagenes[0]} alt={item.nombre} fill sizes="(max-width:768px) 50vw, 25vw" className="object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-50">
                      <span className="text-stone-300 text-sm" style={{ fontFamily: 'var(--font-display)' }}>{item.sku}</span>
                    </div>
                  )}
                </div>
                <h3 className="product-name text-[12px] text-stone-600 uppercase group-hover:text-wine transition-colors">{item.nombre}</h3>
                <p className="text-[11px] text-stone-400 mt-1 font-light">Oro laminado 18k</p>
                <p className="text-[15px] text-stone-700 mt-1.5 font-semibold">{formatCOP(item.precio)}</p>
              </Link>
            ))}
          </div>
          <div className="text-center mt-16">
            <Link href="/catalogo"
              className="inline-flex items-center gap-2 border border-stone-800 text-stone-800 px-10 py-3.5 text-[12px] tracking-[0.1em] uppercase hover:bg-stone-800 hover:text-white transition-all cursor-pointer font-medium">
              Ver todos los productos
            </Link>
          </div>
        </section>
      )}

      {/* Categories — SSR */}
      {categories.length > 0 && (
        <section className="bg-ivory py-24 sm:py-32">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-[10px] text-gold uppercase tracking-[0.4em] mb-4 font-medium">Explorar</p>
              <h2 className="text-[clamp(2rem,4vw,3.2rem)] text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
                Nuestras Colecciones
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
              {categories.map((cat) => (
                <Link key={cat.id} href={`/catalogo?categoria=${cat.slug}`}
                  className="group bg-white border border-stone-200 rounded-lg p-8 text-center hover:border-wine/20 hover:-translate-y-1 transition-all duration-300">
                  <h3 className="text-lg text-stone-800 group-hover:text-wine transition-colors" style={{ fontFamily: 'var(--font-serif)' }}>
                    {cat.nombre}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Tiers */}
      <section className="py-28 sm:py-36 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #0F0A0A 0%, #1a0f10 50%, #0F0A0A 100%)' }}>
        <div className="max-w-[1100px] mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <p className="text-[10px] text-gold/60 uppercase tracking-[0.4em] mb-5 font-medium">Niveles exclusivos</p>
            <h2 className="text-[clamp(2rem,4.5vw,3.5rem)] text-white/90 mb-5" style={{ fontFamily: 'var(--font-serif)' }}>
              Precios que crecen contigo
            </h2>
            <p className="text-white/30 text-sm max-w-lg mx-auto font-light">
              Mientras más compras, más ahorras. Desbloquea descuentos exclusivos según tu volumen.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5 items-end">
            {[
              { name: 'Detal', pct: '0%', desc: 'Sin mínimo de compra', sub: 'Precios de catálogo público', featured: false },
              { name: 'Por Mayor', pct: '37.5%', desc: 'Desde $500.000 en pedido', sub: null, featured: true },
              { name: 'Gran Mayor', pct: '50%', desc: 'Desde $5.000.000 en pedido', sub: 'Máximo descuento disponible', featured: false },
            ].map((t) => (
              <div key={t.name}
                className={`p-8 ${t.featured ? 'sm:p-12' : 'sm:p-10'} text-center rounded-sm ${t.featured ? 'shimmer-border relative' : 'border border-gold/15 hover:border-gold/40 hover:-translate-y-1 transition-all duration-300'}`}
                style={{ background: t.featured ? 'radial-gradient(ellipse at bottom, rgba(201,168,76,0.1) 0%, transparent 70%), #0F0A0A' : 'rgba(255,255,255,0.03)' }}>
                {t.featured && (
                  <div className="absolute -top-3 right-6">
                    <span className="text-[9px] tracking-[0.12em] uppercase px-4 py-1.5 bg-wine text-gold border border-gold/30 font-semibold">Más solicitado</span>
                  </div>
                )}
                <p className={`text-[11px] uppercase tracking-[0.18em] mb-${t.featured ? '6' : '5'} font-medium ${t.featured ? 'text-gold' : 'text-gold/50'}`}>{t.name}</p>
                <div className="flex items-center justify-center gap-4 mb-5">
                  <span className={`w-${t.featured ? '10' : '8'} h-px ${t.featured ? 'bg-gradient-to-r from-transparent to-gold/50' : 'bg-gold/20'}`} />
                  <p className={`text-[${t.featured ? '4.5rem' : '3.5rem'}] ${t.featured ? 'text-gold' : 'text-white/80'} leading-none`} style={{ fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>{t.pct}</p>
                  <span className={`w-${t.featured ? '10' : '8'} h-px ${t.featured ? 'bg-gradient-to-l from-transparent to-gold/50' : 'bg-gold/20'}`} />
                </div>
                <p className="text-[13px] text-white/30 mb-2 font-normal">{t.desc}</p>
                {t.sub && <p className="text-[12px] text-white/20 font-light">{t.sub}</p>}
                {t.featured && (
                  <Link href="/registro" className="inline-block mt-3 border border-gold/40 text-gold/80 px-8 py-2.5 text-[11px] tracking-[0.12em] uppercase hover:bg-gold/10 hover:border-gold/60 transition-all cursor-pointer font-medium">
                    Acceder a este nivel
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
