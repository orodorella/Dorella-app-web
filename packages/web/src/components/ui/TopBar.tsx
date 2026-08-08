'use client';

import { useEffect, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';

const mensajes = [
  'ENVÍOS NACIONALES E INTERNACIONALES — ORO LAMINADO 18K',
  '30 micras de oro 18k en cada pieza',
  'Envíos a todo Colombia y al exterior',
  'Calidad premium al mejor precio mayorista',
];

export default function TopBar() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setIdx((i) => (i + 1) % mensajes.length), 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-wine text-champagne/80 text-[10px] sm:text-[11px] tracking-[0.25em] uppercase py-2.5 text-center overflow-hidden">
      <AnimatePresence mode="wait">
        <m.span
          key={idx}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="inline-block font-light tracking-[0.2em]"
        >
          {mensajes[idx]}
        </m.span>
      </AnimatePresence>
    </div>
  );
}
