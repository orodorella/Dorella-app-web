'use client';

import { useState, useEffect } from 'react';
import { request } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthProvider';
import Link from 'next/link';
import { BookOpen, Lock, CheckCircle, Loader2, Play } from 'lucide-react';
import { motion } from 'framer-motion';

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  baseTier: string;
  unlockPrice: number;
  totalModules: number;
  totalVideos: number;
  totalDuration: number;
  hasAccess: boolean;
}

const TIER_LABELS: Record<string, string> = {
  detal: 'Detal',
  por_mayor: 'Mayorista',
  gran_mayor: 'Gran Mayorista',
};

export default function AcademiaPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request('GET', '/api/academy/courses')
      .then((res) => { if (res.success) setCourses(res.data); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {/* Hero Section */}
      <section className="bg-white border-b border-stone-100">
        <div className="max-w-[1200px] mx-auto px-6 py-20 sm:py-28 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}>
            <p className="text-[10px] text-gold uppercase tracking-[0.4em] mb-5 font-medium">Formación exclusiva</p>
            <h1 className="text-[clamp(2rem,4vw,3.2rem)] text-stone-800 mb-5" style={{ fontFamily: 'var(--font-serif)' }}>
              Academia D&apos;orella
            </h1>
            <div className="separator max-w-[80px] mx-auto mb-6" />
            <p className="text-sm text-stone-500 max-w-lg mx-auto font-light leading-relaxed">
              Cursos exclusivos de capacitación para emprendedores de joyería. Marketing digital, finanzas, técnicas de venta y más.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Courses Grid */}
      <section className="bg-ivory">
        <div className="max-w-[1200px] mx-auto px-6 py-20 sm:py-28">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-wine" size={24} />
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[10px] text-stone-400 uppercase tracking-[0.25em] mb-3 font-medium">Próximamente</p>
              <p className="text-lg text-stone-600" style={{ fontFamily: 'var(--font-serif)' }}>
                Estamos preparando cursos para vos
              </p>
              <p className="text-sm text-stone-400 mt-2 font-light">
                Contenido exclusivo para emprendedores de joyería. Volvé pronto.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
              {courses.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1, ease: [0.4, 0, 0.2, 1] }}
                >
                  <Link href={`/academia/${c.slug}`}
                    className="group block bg-white border border-stone-200 rounded-lg overflow-hidden shadow-luxury hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                    {/* Image */}
                    <div className="aspect-video bg-stone-50 overflow-hidden relative">
                      {c.imageUrl ? (
                        <img src={c.imageUrl} alt={c.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-wine/5 to-wine/[0.02]">
                          <div className="w-14 h-14 rounded-full bg-wine/10 flex items-center justify-center">
                            <Play className="text-wine/40" size={20} />
                          </div>
                        </div>
                      )}
                      {/* Tier badge overlay */}
                      <div className="absolute top-3 left-3">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-wine bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full">
                          {TIER_LABELS[c.baseTier]}
                        </span>
                      </div>
                      {/* Access badge */}
                      {c.hasAccess && (
                        <div className="absolute top-3 right-3">
                          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-green-700 bg-green-50/90 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1">
                            <CheckCircle size={10} /> Inscrito
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <h3 className="text-[15px] text-stone-800 group-hover:text-wine transition-colors" style={{ fontFamily: 'var(--font-serif)' }}>
                        {c.title}
                      </h3>
                      {c.description && (
                        <p className="text-xs text-stone-400 mt-1.5 line-clamp-2 font-light leading-relaxed">
                          {c.description}
                        </p>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-stone-100">
                        <span className="flex items-center gap-1.5 text-[11px] text-stone-400 font-light">
                          <BookOpen size={12} /> {c.totalModules} módulos
                        </span>
                        <span className="text-[11px] text-stone-400 font-light">
                          {c.totalVideos} videos
                        </span>
                        {c.totalDuration > 0 && (
                          <span className="text-[11px] text-stone-400 font-light">
                            ~{c.totalDuration >= 3600
                              ? `${Math.floor(c.totalDuration / 3600)}h ${Math.floor((c.totalDuration % 3600) / 60)}min`
                              : `${Math.ceil(c.totalDuration / 60)} min`}
                          </span>
                        )}
                        {!c.hasAccess && user && (
                          <span className="flex items-center gap-1 text-[11px] text-wine font-medium ml-auto">
                            <Lock size={11} /> {Number(c.unlockPrice).toLocaleString('es-CO')} COP
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
