'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BookOpen, Lock, CheckCircle, Loader2, Play, ArrowRight } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthProvider';
import { canAccessAcademy, canAccessCourse, normalizeUserTier } from '@/lib/academy-access';

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  baseTier: string;
  totalModules: number;
  totalVideos: number;
  totalDuration: number;
  hasAccess: boolean;
}

const ACCESS_LABELS: Record<string, string> = {
  detal: 'Por Mayor + Gran Mayor',
  por_mayor: 'Por Mayor + Gran Mayor',
  gran_mayor: 'Solo Gran Mayor',
};

const WHATSAPP_HREF =
  'https://wa.me/573156343383?text=Hola%21%20quiero%20ser%20parte%20de%20Academia%20Dorella%20y%20subir%20a%20plan%20Por%20Mayor%20o%20Gran%20Mayor.%20%C2%BFQue%20debo%20hacer%3F';

export default function AcademiaPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const canAccessAcademia = canAccessAcademy(user);
  const blockedAcademia = !canAccessAcademia;
  const normalizedTier = normalizeUserTier(user);
  const isPorMayor = normalizedTier === 'por_mayor';

  useEffect(() => {
    request('GET', '/api/academy/courses')
      .then((res) => {
        if (res.success) setCourses(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <section className="border-b border-stone-100 bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-20 text-center sm:py-28">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          >
            <p className="mb-5 text-[10px] font-medium uppercase tracking-[0.4em] text-gold">Formacion exclusiva</p>
            <h1 className="mb-5 text-[clamp(2rem,4vw,3.2rem)] text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
              Academia D&apos;orella
            </h1>
            <div className="separator mx-auto mb-6 max-w-[80px]" />
            <p className="mx-auto max-w-lg text-sm font-light leading-relaxed text-stone-500">
              Cursos exclusivos para emprendedores de joyeria que quieren vender con mas criterio, presentacion y estrategia.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="bg-ivory">
        <div className="mx-auto max-w-[1200px] px-6 py-20 sm:py-28">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-wine" size={24} />
            </div>
          ) : courses.length === 0 ? (
            <div className="py-16 text-center">
              <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.25em] text-stone-400">Proximamente</p>
              <p className="text-lg text-stone-600" style={{ fontFamily: 'var(--font-serif)' }}>
                Estamos preparando cursos para vos
              </p>
              <p className="mt-2 text-sm font-light text-stone-400">Contenido exclusivo para emprendedores de joyeria. Vuelve pronto.</p>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/70 shadow-luxury">
              <div className={blockedAcademia ? 'pointer-events-none select-none blur-[6px] saturate-[0.92]' : ''}>
                <div className="grid gap-7 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-3">
                  {courses.map((course, index) => {
                    const lockedForGranMayor = canAccessAcademia && !canAccessCourse(user, { isActive: true, baseTier: course.baseTier });
                    const cardContent = (
                      <>
                        <div className="relative aspect-video overflow-hidden bg-stone-50">
                          {course.imageUrl ? (
                            <img
                              src={course.imageUrl}
                              alt={course.title}
                              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-wine/5 to-wine/[0.02]">
                              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-wine/10">
                                <Play className="text-wine/40" size={20} />
                              </div>
                            </div>
                          )}

                          <div className="absolute left-3 top-3">
                            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-wine backdrop-blur-sm">
                              {ACCESS_LABELS[course.baseTier] || ACCESS_LABELS.por_mayor}
                            </span>
                          </div>

                          {course.hasAccess ? (
                            <div className="absolute right-3 top-3">
                              <span className="flex items-center gap-1 rounded-full bg-green-50/90 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-green-700 backdrop-blur-sm">
                                <CheckCircle size={10} /> Disponible
                              </span>
                            </div>
                          ) : lockedForGranMayor ? (
                            <div className="absolute right-3 top-3">
                              <span className="flex items-center gap-1 rounded-full bg-jeweler/70 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
                                <Lock size={10} /> Gran Mayor
                              </span>
                            </div>
                          ) : null}
                        </div>

                        <div className="p-5">
                          <h3
                            className="text-[15px] text-stone-800 transition-colors group-hover:text-wine"
                            style={{ fontFamily: 'var(--font-serif)' }}
                          >
                            {course.title}
                          </h3>

                          {course.description && (
                            <p className="mt-1.5 line-clamp-2 text-xs font-light leading-relaxed text-stone-400">
                              {course.description}
                            </p>
                          )}

                          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-stone-100 pt-4">
                            <span className="flex items-center gap-1.5 text-[11px] font-light text-stone-400">
                              <BookOpen size={12} /> {course.totalModules} modulos
                            </span>
                            <span className="text-[11px] font-light text-stone-400">{course.totalVideos} videos</span>
                            {course.totalDuration > 0 && (
                              <span className="text-[11px] font-light text-stone-400">
                                ~
                                {course.totalDuration >= 3600
                                  ? `${Math.floor(course.totalDuration / 3600)}h ${Math.floor((course.totalDuration % 3600) / 60)}min`
                                  : `${Math.ceil(course.totalDuration / 60)} min`}
                              </span>
                            )}
                          </div>

                          {lockedForGranMayor && (
                            <p className="mt-3 text-[11px] font-light leading-relaxed text-stone-500">
                              Disponible para clientes Gran Mayor.
                            </p>
                          )}
                        </div>
                      </>
                    );

                    return (
                      <motion.div
                        key={course.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1, ease: [0.4, 0, 0.2, 1] }}
                      >
                        {lockedForGranMayor ? (
                          <div className="group block overflow-hidden rounded-lg border border-stone-200 bg-white shadow-luxury">
                            {cardContent}
                          </div>
                        ) : (
                          <Link
                            href={`/academia/${course.slug}`}
                            className="group block overflow-hidden rounded-lg border border-stone-200 bg-white shadow-luxury transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                          >
                            {cardContent}
                          </Link>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {blockedAcademia && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-jeweler/55 via-jeweler/60 to-wine/55 p-4 sm:p-6">
                  <div className="w-full max-w-xl rounded-[24px] border border-white/15 bg-white/80 px-5 py-6 text-center shadow-2xl backdrop-blur-xl sm:px-8 sm:py-8">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-wine/15 bg-wine/10 text-wine">
                      <Lock size={19} />
                    </div>
                    <p className="mb-2 text-[9px] font-medium uppercase tracking-[0.28em] text-gold">Contenido exclusivo</p>
                    <h2 className="text-[1.75rem] leading-tight text-stone-800 sm:text-[2.1rem]" style={{ fontFamily: 'var(--font-serif)' }}>
                      Academia Dorella es contenido exclusivo
                    </h2>
                    <p className="mx-auto mt-3 max-w-lg text-[13px] font-light leading-relaxed text-stone-600 sm:text-sm">
                      Accede al plan Por Mayor o Gran Mayor para desbloquear los cursos de Academia Dorella y aprender a vender,
                      presentar y potenciar tu joyeria con mas criterio.
                    </p>
                    <p className="mx-auto mt-2.5 max-w-md text-[11px] font-light leading-relaxed text-stone-500 sm:text-[13px]">
                      Te guiaremos por WhatsApp para conocer los requisitos y beneficios de cada nivel.
                    </p>
                    <div className="mt-5 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
                      <a
                        href={WHATSAPP_HREF}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-wine px-6 py-3.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-wine-light sm:w-auto"
                      >
                        Quiero ser parte ya
                        <ArrowRight size={15} />
                      </a>
                      <Link
                        href="/catalogo"
                        className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full border border-stone-300/80 px-6 py-3.5 text-[10px] font-medium uppercase tracking-[0.16em] text-stone-700 transition-colors hover:border-stone-400 hover:text-stone-900 sm:w-auto"
                      >
                        Ver catalogo
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {canAccessAcademia && isPorMayor && courses.some((course) => !course.hasAccess) && (
            <div className="mt-6 rounded-2xl border border-gold/20 bg-white/70 px-5 py-4 text-sm text-stone-600 shadow-luxury">
              Algunos cursos estan reservados para clientes Gran Mayor y apareceran identificados dentro de la Academia.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
