import { motion } from 'framer-motion'
import { ArrowRight, Eye, Share2, CheckSquare } from 'lucide-react'
import { products } from '../mocks/products'
import { formatCOP } from '../components/PriceDisplay'

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
}

const previewProducts = products.filter((p) => p.imagen).slice(0, 6)

export default function CatalogoSinMarca() {
  return (
    <div className="flex-1 bg-white min-h-screen">
      {/* Hero */}
      <section className="bg-ivory py-20 sm:py-28">
        <div className="max-w-[900px] mx-auto px-6 text-center">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-gold text-[10px] tracking-[0.4em] uppercase mb-4 font-medium"
          >
            Para revendedores
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl text-stone-800 mb-6"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Catálogo sin marca
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-stone-500 text-lg max-w-xl mx-auto font-light leading-relaxed"
          >
            Comparte un catálogo profesional con tus clientes sin que aparezca la marca D'orella.
            Tus clientes ven los productos, tú manejas los precios.
          </motion.p>
        </div>
      </section>

      {/* 3 Steps */}
      <section className="max-w-[1000px] mx-auto px-6 py-20 sm:py-24">
        <motion.div {...fadeUp} className="text-center mb-16">
          <h2 className="text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
            Cómo funciona
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-3 gap-8 sm:gap-12">
          {[
            { step: '01', icon: CheckSquare, title: 'Selecciona productos', desc: 'Elige las piezas que quieres mostrar a tus clientes desde nuestro catálogo completo.' },
            { step: '02', icon: Eye, title: 'Genera catálogo limpio', desc: 'Se genera automáticamente un catálogo profesional sin logos, sin precios mayoristas, sin marca D\'orella.' },
            { step: '03', icon: Share2, title: 'Comparte con tus clientes', desc: 'Envía el catálogo por WhatsApp, redes sociales o correo. Tú defines tus precios de venta.' },
          ].map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className="text-center"
            >
              <div className="w-12 h-12 mx-auto mb-5 border border-stone-200 flex items-center justify-center">
                <s.icon size={20} className="text-wine" strokeWidth={1.5} />
              </div>
              <p className="text-[10px] text-gold uppercase tracking-[0.3em] font-semibold mb-2">{s.step}</p>
              <h3 className="text-lg text-stone-800 mb-2" style={{ fontFamily: 'var(--font-display)' }}>{s.title}</h3>
              <p className="text-sm text-stone-400 font-light leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Preview mockup */}
      <section className="bg-ivory py-20 sm:py-24">
        <div className="max-w-[1000px] mx-auto px-6">
          <motion.div {...fadeUp} className="text-center mb-14">
            <p className="text-gold text-[10px] tracking-[0.4em] uppercase mb-3 font-medium">Vista previa</p>
            <h2 className="text-3xl text-stone-800 mb-3" style={{ fontFamily: 'var(--font-display)' }}>
              Así se ve tu catálogo
            </h2>
            <p className="text-sm text-stone-400 font-light">Sin marca, sin precios mayoristas — solo producto puro</p>
          </motion.div>

          {/* Mockup frame */}
          <div className="bg-white border border-stone-200 rounded-lg shadow-luxury p-6 sm:p-10 max-w-[800px] mx-auto">
            <div className="text-center mb-8">
              <p className="text-lg text-stone-300 italic" style={{ fontFamily: 'var(--font-display)' }}>Tu marca aquí</p>
              <div className="separator mt-4" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
              {previewProducts.map((p) => (
                <div key={p.id} className="text-center">
                  <div className="aspect-square bg-stone-50 overflow-hidden mb-3">
                    <img src={p.imagen} alt={p.nombre} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[11px] text-stone-600 uppercase tracking-[0.05em]">{p.nombre}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">{p.material}</p>
                  <p className="text-sm text-stone-300 mt-1 italic">Consultar precio</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[700px] mx-auto px-6 py-20 sm:py-24 text-center">
        <motion.div {...fadeUp}>
          <h2 className="text-3xl text-stone-800 mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Empieza a vender con tu propia marca
          </h2>
          <p className="text-stone-400 text-sm max-w-md mx-auto font-light mb-10">
            Accede a precios mayoristas desde $500.000 y genera catálogos ilimitados sin marca para compartir con tus clientes.
          </p>
          <a
            href="https://wa.me/573000000000?text=Hola%2C%20quiero%20solicitar%20acceso%20mayorista%20para%20el%20catálogo%20sin%20marca"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-wine text-white px-10 py-4 font-semibold text-[11px] uppercase tracking-[0.2em] hover:bg-wine-light transition-colors cursor-pointer"
          >
            Solicitar acceso mayorista
            <ArrowRight size={16} />
          </a>
        </motion.div>
      </section>
    </div>
  )
}
