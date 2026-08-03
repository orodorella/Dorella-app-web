'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const WHOLESALE_WHATSAPP_HREF =
  'https://wa.me/573156343383?text=Hola%21%20quiero%20comprar%20al%20por%20mayor%20o%20gran%20mayor.%20%C2%BFQu%C3%A9%20debo%20hacer%3F';

export default function HomeHero() {
  return (
    <section className="relative h-[90vh] min-h-[640px] overflow-hidden bg-jeweler flex items-center">
      <motion.div
        initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0"
      >
        <Image
          src="/images/hero-jewelry.png"
          alt="Joyería en oro laminado 18k sobre terciopelo"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[75%_center]"
        />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/10" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 w-full">
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="text-[10px] tracking-[0.5em] uppercase mb-8 text-gold/70 flex items-center gap-4 font-medium"
        />

        <motion.h1
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="editorial-title text-[clamp(2.2rem,9vw,4.5rem)] text-white mb-8 max-w-2xl"
        >
          Joyería en{' '}
          <span className="uppercase tracking-[0.04em]">oro laminado 18k</span>{' '}
          con <em className="text-gold italic">presencia premium</em>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.7 }}
          className="text-white/50 text-[15px] max-w-lg leading-relaxed mb-10 font-light"
        >
          Joyas que destacan. Calidad que te respalda.
          {' '}Piezas en oro laminado de 30 micras. Perfectas para lucir, regalar o impulsar tu propio negocio.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Link
            href="/catalogo"
            className="btn-primary group inline-flex items-center justify-center gap-3 bg-white text-stone-800 px-10 py-4 text-[12px] tracking-[0.12em] uppercase cursor-pointer hover:bg-stone-50 transition-colors font-medium"
          >
            Explorar catálogo
            <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href={WHOLESALE_WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 border border-white/30 text-white/80 px-10 py-4 text-[12px] tracking-[0.12em] uppercase cursor-pointer hover:bg-white/10 hover:border-white/50 transition-all font-medium"
          >
            Comprar al por mayor
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
