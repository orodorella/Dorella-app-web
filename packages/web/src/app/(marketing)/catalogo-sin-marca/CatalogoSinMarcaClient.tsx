'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Eye, Share2, CheckSquare } from 'lucide-react';

const fadeUp = { initial: { opacity: 0, y: 30 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] as const } };

export default function CatalogoSinMarcaClient() {
  return (
    <div className="flex-1 bg-white min-h-screen">
      <section className="bg-ivory py-20 sm:py-28">
        <div className="max-w-[900px] mx-auto px-6 text-center">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-gold text-[10px] tracking-[0.4em] uppercase mb-4 font-medium">Para revendedores</motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-4xl sm:text-5xl text-stone-800 mb-6" style={{ fontFamily: 'var(--font-display)' }}>Catálogo sin marca</motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-stone-500 text-lg max-w-xl mx-auto font-light leading-relaxed">
            Comparte un catálogo profesional con tus clientes sin que aparezca la marca D&apos;orella. Tus clientes ven los productos, tú manejas los precios.
          </motion.p>
        </div>
      </section>

      <section className="max-w-[1000px] mx-auto px-6 py-20 sm:py-24">
        <motion.div {...fadeUp} className="text-center mb-16"><h2 className="text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Cómo funciona</h2></motion.div>
        <div className="grid sm:grid-cols-3 gap-8 sm:gap-12">
          {[
            { step: '01', icon: CheckSquare, title: 'Selecciona productos', desc: 'Elige las piezas que quieres mostrar a tus clientes desde nuestro catálogo completo.' },
            { step: '02', icon: Eye, title: 'Genera catálogo limpio', desc: 'Se genera automáticamente un catálogo profesional sin logos, sin precios mayoristas, sin marca D\'orella.' },
            { step: '03', icon: Share2, title: 'Comparte con tus clientes', desc: 'Envía el catálogo por WhatsApp, redes sociales o correo. Tú defines tus precios de venta.' },
          ].map((s, i) => (
            <motion.div key={s.step} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }} className="text-center">
              <div className="w-12 h-12 mx-auto mb-5 border border-stone-200 flex items-center justify-center"><s.icon size={20} className="text-wine" strokeWidth={1.5} /></div>
              <p className="text-[10px] text-gold uppercase tracking-[0.3em] font-semibold mb-2">{s.step}</p>
              <h3 className="text-lg text-stone-800 mb-2" style={{ fontFamily: 'var(--font-display)' }}>{s.title}</h3>
              <p className="text-sm text-stone-400 font-light leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-[700px] mx-auto px-6 py-20 sm:py-24 text-center">
        <motion.div {...fadeUp}>
          <h2 className="text-3xl text-stone-800 mb-4" style={{ fontFamily: 'var(--font-display)' }}>Empieza a vender con tu propia marca</h2>
          <p className="text-stone-400 text-sm max-w-md mx-auto font-light mb-10">Accede a precios mayoristas desde $500.000 y genera catálogos ilimitados.</p>
          <Link href="/mis-catalogos" className="inline-flex items-center gap-3 bg-wine text-white px-10 py-4 font-semibold text-[11px] uppercase tracking-[0.2em] hover:bg-wine-light transition-colors cursor-pointer">
            Crear mi catálogo <ArrowRight size={16} />
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
