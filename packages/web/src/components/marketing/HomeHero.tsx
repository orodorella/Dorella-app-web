'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';

export default function HomeHero() {
  const { user } = useAuth();
  const target = user ? '/catalogo' : '/login';

  return (
    <section className="relative h-[90vh] min-h-[640px] overflow-hidden bg-jeweler flex items-center">
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 w-full">
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="text-[10px] tracking-[0.5em] uppercase mb-8 text-gold/70 flex items-center gap-4 font-medium"
        >
          <span className="w-10 h-px bg-gold/50" />
          D&apos;orella — Mayoristas
        </motion.p>

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
          Piezas elegantes para comprar, regalar y emprender con respaldo.
          30 micras de oro en cada pieza.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Link href={target}
            className="btn-primary group inline-flex items-center justify-center gap-3 bg-white text-stone-800 px-10 py-4 text-[12px] tracking-[0.12em] uppercase cursor-pointer hover:bg-stone-50 transition-colors font-medium">
            Explorar catálogo
            <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link href={target}
            className="inline-flex items-center justify-center gap-3 border border-white/30 text-white/80 px-10 py-4 text-[12px] tracking-[0.12em] uppercase cursor-pointer hover:bg-white/10 hover:border-white/50 transition-all font-medium">
            Comprar al por mayor
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
