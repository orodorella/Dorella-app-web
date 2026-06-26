import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useApp } from '../context/AppContext'

import heroImg from '../imagenes/ChatGPT Image 22 jun 2026, 12_42_35 a.m..png'
import img26 from '../imagenes/26.webp'
import img48 from '../imagenes/48.webp'
import img45 from '../imagenes/45.webp'
import img50 from '../imagenes/50.webp'
import imgAretes from '../imagenes/aretes-candonga-balin-circon-centro-17mm-6449663.webp'
import imgCadenas from '../imagenes/21.webp'
import imgAnillos from '../imagenes/12.webp'

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
}

function stagger(i) {
  return { ...reveal, transition: { ...reveal.transition, delay: i * 0.08 } }
}

export default function Home() {
  const { user } = useApp()

  return (
    <div className="flex-1">

      {/* ══════════ HERO ══════════ */}
      <section className="relative h-[90vh] min-h-[640px] overflow-hidden bg-jeweler">
        <motion.img
          src={heroImg}
          alt="D'orella — Joyería en oro laminado 18k"
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ scale: 1.05 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />

        <div className="relative z-10 h-full max-w-[1200px] mx-auto px-6 flex flex-col justify-center">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-[10px] tracking-[0.5em] uppercase mb-8 text-gold/70 flex items-center gap-4 font-medium"
          >
            <span className="w-10 h-px bg-gold/50" />
            D'orella — Mayoristas
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="editorial-title text-[clamp(2.2rem,9vw,4.5rem)] text-white mb-8 max-w-2xl"
          >
            Joyería en{' '}
            <span className="uppercase tracking-[0.04em]">oro laminado 18k</span>{' '}
            con <em className="text-gold italic">presencia premium</em>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.7 }}
            className="text-white/50 text-[15px] max-w-lg leading-relaxed mb-10 font-light"
          >
            Piezas elegantes para comprar, regalar y emprender con respaldo.
            30 micras de oro en cada pieza.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <Link
              to={user ? '/catalogo' : '/login'}
              className="btn-primary group inline-flex items-center justify-center gap-3 bg-white text-stone-800 px-10 py-4 text-[12px] tracking-[0.12em] uppercase cursor-pointer hover:bg-stone-50 transition-colors font-medium"
            >
              Explorar catálogo
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to={user ? '/catalogo' : '/login'}
              className="inline-flex items-center justify-center gap-3 border border-white/30 text-white/80 px-10 py-4 text-[12px] tracking-[0.12em] uppercase cursor-pointer hover:bg-white/10 hover:border-white/50 transition-all font-medium"
            >
              Comprar al por mayor
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ══════════ STATS BAR ══════════ */}
      <section className="border-y border-stone-100 bg-white">
        <div className="max-w-[1000px] mx-auto px-6 py-14 flex flex-col sm:flex-row items-center justify-center gap-10 sm:gap-0">
          {[
            { value: '30 micras', label: 'de oro 18k' },
            { value: 'Más de 500', label: 'referencias' },
            { value: 'Hasta 37.5%', label: 'en compras mayoristas' },
          ].map((stat, i) => (
            <motion.div key={stat.label} {...stagger(i)} className={`text-center flex-1 ${i > 0 ? 'sm:border-l sm:border-stone-100' : ''}`}>
              <p className="text-[1.8rem] text-stone-800" style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, letterSpacing: '-0.02em' }}>
                {stat.value}
              </p>
              <p className="text-[10px] text-stone-400 uppercase tracking-[0.25em] mt-2 font-medium">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════ FEATURED PIECES ══════════ */}
      <section className="max-w-[1200px] mx-auto px-6 py-24 sm:py-32">
        <motion.div {...reveal} className="text-center mb-16">
          <p className="text-[10px] text-gold uppercase tracking-[0.4em] mb-4 font-medium">
            Selección
          </p>
          <h2 className="text-[clamp(2rem,4vw,3.2rem)] text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
            Piezas Destacadas
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-7">
          {[
            { img: img26, name: 'Aretes Trébol Amatista', price: '$52.900', tag: 'Nuevo', id: 36 },
            { img: img48, name: 'Aretes Candongas Florencia', price: '$52.900', tag: null, id: 3 },
            { img: img45, name: 'Dije Inicial Cursiva', price: '$32.900', tag: 'Exclusivo', id: 23 },
            { img: img50, name: 'Conjunto Clásico Dorado', price: '$155.900', tag: null, id: 28 },
          ].map((item, i) => (
            <motion.div key={item.name} {...stagger(i)}>
              <Link to={`/producto/${item.id}`} className="group cursor-pointer block">
                <div className="relative aspect-square overflow-hidden bg-stone-50 mb-5">
                  <img src={item.img} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  {item.tag && (
                    <span className="absolute top-4 left-4 bg-gold text-jeweler text-[9px] tracking-[0.12em] uppercase px-3 py-1 font-semibold">
                      {item.tag}
                    </span>
                  )}
                </div>
                <h3 className="product-name text-[12px] text-stone-600 uppercase group-hover:text-wine transition-colors">
                  {item.name}
                </h3>
                <p className="text-[11px] text-stone-400 mt-1 font-light">
                  Oro laminado 18k
                </p>
                <p className="text-[15px] text-stone-700 mt-1.5 font-semibold">
                  {item.price}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div {...reveal} className="text-center mt-16">
          <Link
            to={user ? '/catalogo' : '/login'}
            className="inline-flex items-center gap-2 border border-stone-800 text-stone-800 px-10 py-3.5 text-[12px] tracking-[0.1em] uppercase hover:bg-stone-800 hover:text-white transition-all cursor-pointer font-medium"
          >
            Ver todos los productos
          </Link>
        </motion.div>
      </section>

      {/* ══════════ COLLECTIONS ══════════ */}
      <section className="bg-ivory py-24 sm:py-32">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div {...reveal} className="text-center mb-16">
            <p className="text-[10px] text-gold uppercase tracking-[0.4em] mb-4 font-medium">
              Explorar
            </p>
            <h2 className="text-[clamp(2rem,4vw,3.2rem)] text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
              Nuestras Colecciones
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { img: imgAretes, name: 'Aretes', desc: 'Elegancia para cada ocasión' },
              { img: imgCadenas, name: 'Cadenas', desc: 'El brillo que te acompaña' },
              { img: imgAnillos, name: 'Anillos', desc: 'Símbolo de compromiso' },
            ].map((col, i) => (
              <motion.div key={col.name} {...stagger(i)}>
                <Link to="/catalogo" className="group relative block aspect-[3/4] overflow-hidden cursor-pointer">
                  <img src={col.img} alt={col.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                    <h3 className="text-[1.8rem] text-white mb-1" style={{ fontFamily: 'var(--font-serif)' }}>
                      {col.name}
                    </h3>
                    <p className="text-white/50 text-sm font-light">
                      {col.desc}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ BRAND PROMISE ══════════ */}
      <section className="py-24 sm:py-32 bg-white">
        <div className="max-w-[1100px] mx-auto px-6">
          <motion.div {...reveal} className="max-w-2xl mb-20">
            <p className="text-[10px] text-gold uppercase tracking-[0.4em] mb-5 font-medium">
              La esencia D'orella
            </p>
            <h2 className="text-[clamp(2rem,4vw,3.2rem)] text-stone-800 leading-[1.1] mb-6" style={{ fontFamily: 'var(--font-serif)' }}>
              Elegancia con respaldo
            </h2>
            <p className="text-stone-400 text-[15px] leading-relaxed font-light">
              Diseñamos piezas en oro laminado 18k con acabado premium, garantía y una propuesta
              pensada tanto para uso personal como para emprender.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-16 lg:gap-20 items-start">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:block"
            >
              <div className="aspect-[3/4] overflow-hidden">
                <img src={imgAretes} alt="Detalle de aretes D'orella" className="w-full h-full object-cover" />
              </div>
              <p className="text-[10px] text-stone-300 uppercase tracking-[0.2em] mt-4 font-light">
                <em>Aretes candonga</em> — Oro laminado 18k, 30 micras
              </p>
            </motion.div>

            <div>
              {[
                { title: '30 micras de oro 18k', desc: 'El laminado más alto del mercado para piezas con brillo, presencia y resistencia al uso diario.' },
                { title: 'Garantía de tonalidad', desc: 'Si el tono cambia, respaldamos tu pieza con reposición según nuestras políticas de garantía.' },
                { title: 'Despacho nacional', desc: 'Enviamos a toda Colombia con empaque cuidado, presentación premium y seguimiento.' },
                { title: 'Calidad y durabilidad', desc: 'Cada pieza pasa por control de calidad para ofrecer mejor acabado, presencia y permanencia.' },
              ].map((f, i) => (
                <motion.div key={f.title} {...stagger(i)} className="group py-8 border-b border-stone-100 first:pt-0 last:border-b-0">
                  <div className="flex items-start gap-6">
                    <span className="w-px h-12 bg-gold/30 flex-shrink-0 mt-1 group-hover:bg-gold transition-colors duration-500" />
                    <div>
                      <h3 className="text-[1.4rem] text-stone-800 mb-2 group-hover:text-wine transition-colors duration-500"
                        style={{ fontFamily: 'var(--font-serif)' }}>
                        {f.title}
                      </h3>
                      <p className="text-[14px] text-stone-400 leading-relaxed max-w-md font-light">
                        {f.desc}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ TIERS — Premium Dark ══════════ */}
      <section className="py-28 sm:py-36 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #0F0A0A 0%, #1a0f10 50%, #0F0A0A 100%)' }}>
        <div className="max-w-[1100px] mx-auto px-6 relative z-10">
          <motion.div {...reveal} className="text-center mb-20">
            <p className="text-[10px] text-gold/60 uppercase tracking-[0.4em] mb-5 font-medium">
              Niveles exclusivos
            </p>
            <h2 className="text-[clamp(2rem,4.5vw,3.5rem)] text-white/90 mb-5"
              style={{ fontFamily: 'var(--font-serif)' }}>
              Precios que crecen contigo
            </h2>
            <p className="text-white/30 text-sm max-w-lg mx-auto font-light">
              Mientras más compras, más ahorras. Desbloquea descuentos exclusivos según tu volumen.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-5 items-end">
            {/* Detal */}
            <motion.div {...stagger(0)}
              className="p-8 sm:p-10 text-center rounded-sm border border-gold/15 hover:border-gold/40 hover:-translate-y-1 transition-all duration-300"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <p className="text-[11px] text-gold/50 uppercase tracking-[0.18em] mb-5 font-medium">
                Detal
              </p>
              <div className="flex items-center justify-center gap-4 mb-5">
                <span className="w-8 h-px bg-gold/20" />
                <p className="text-[3.5rem] text-white/80 leading-none" style={{ fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>
                  0%
                </p>
                <span className="w-8 h-px bg-gold/20" />
              </div>
              <p className="text-[13px] text-white/30 mb-2 font-normal">
                Sin mínimo de compra
              </p>
              <p className="text-[12px] text-white/20 font-light">
                Precios de catálogo público
              </p>
            </motion.div>

            {/* Por Mayor — Featured */}
            <motion.div {...stagger(1)}
              className="p-8 sm:p-12 text-center rounded-sm shimmer-border relative"
              style={{
                background: 'radial-gradient(ellipse at bottom, rgba(201,168,76,0.1) 0%, transparent 70%), #0F0A0A',
              }}
            >
              <div className="absolute -top-3 right-6">
                <span className="text-[9px] tracking-[0.12em] uppercase px-4 py-1.5 bg-wine text-gold border border-gold/30 font-semibold">
                  Más solicitado
                </span>
              </div>
              <p className="text-[11px] text-gold uppercase tracking-[0.18em] mb-6 font-medium">
                Por Mayor
              </p>
              <div className="flex items-center justify-center gap-4 mb-6">
                <span className="w-10 h-px bg-gradient-to-r from-transparent to-gold/50" />
                <p className="text-[4.5rem] text-gold leading-none" style={{ fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>
                  37.5%
                </p>
                <span className="w-10 h-px bg-gradient-to-l from-transparent to-gold/50" />
              </div>
              <p className="text-[13px] text-white/40 mb-3 font-normal">
                Desde $500.000 en pedido
              </p>
              <Link
                to={user ? '/catalogo' : '/login'}
                className="inline-block mt-3 border border-gold/40 text-gold/80 px-8 py-2.5 text-[11px] tracking-[0.12em] uppercase hover:bg-gold/10 hover:border-gold/60 transition-all cursor-pointer font-medium"
              >
                Acceder a este nivel
              </Link>
            </motion.div>

            {/* Gran Mayor */}
            <motion.div {...stagger(2)}
              className="p-8 sm:p-10 text-center rounded-sm border border-gold/15 hover:border-gold/40 hover:-translate-y-1 transition-all duration-300"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <p className="text-[11px] text-gold/50 uppercase tracking-[0.18em] mb-5 font-medium">
                Gran Mayor
              </p>
              <div className="flex items-center justify-center gap-4 mb-5">
                <span className="w-8 h-px bg-gold/20" />
                <p className="text-[3.5rem] text-white/80 leading-none" style={{ fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>
                  50%
                </p>
                <span className="w-8 h-px bg-gold/20" />
              </div>
              <p className="text-[13px] text-white/30 mb-2 font-normal">
                Desde $5.000.000 en pedido
              </p>
              <p className="text-[12px] text-white/20 font-light">
                Máximo descuento disponible
              </p>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  )
}
