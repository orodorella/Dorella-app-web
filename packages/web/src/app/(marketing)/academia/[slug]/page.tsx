'use client';

import { useState, useEffect, useCallback } from 'react';
import { request } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/context/ToastProvider';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, CheckCircle, Lock, Loader2, GraduationCap, ArrowRight } from 'lucide-react';
import { m } from 'framer-motion';
import { canAccessCourse } from '@/lib/academy-access';

interface Video {
  id: string;
  title: string;
  youtubeUrl: string;
  duration: number | null;
  isFreePreview: boolean;
  description: string | null;
  watched?: boolean;
}

interface Module {
  id: string;
  title: string;
  description: string | null;
  order: number;
  videos: Video[];
}

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  baseTier: string;
  hasAccess: boolean;
  watchedCount: number;
  totalVideos: number;
  modules: Module[];
}

const ACCESS_LABELS: Record<string, string> = {
  detal: 'Por Mayor + Gran Mayor',
  por_mayor: 'Por Mayor + Gran Mayor',
  gran_mayor: 'Solo Gran Mayor',
};

const WHATSAPP_UPGRADE_HREF =
  'https://wa.me/573156343383?text=Hola%21%20quiero%20subir%20a%20cliente%20Gran%20Mayor%20para%20acceder%20a%20los%20cursos%20exclusivos%20de%20Academia%20Dorella.%20%C2%BFQue%20debo%20hacer%3F';

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&?#]+)/);
  return match ? match[1] : null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AcademyCoursePage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const params = useParams();
  const slug = params.slug as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request('GET', `/api/academy/courses/${slug}`);
      if (res.success) {
        setCourse(res.data);
        const firstVideo = res.data.hasAccess
          ? res.data.modules?.flatMap((module: Module) => module.videos).find((video: Video) => video.isFreePreview || res.data.hasAccess)
          : null;
        if (firstVideo) setActiveVideo(firstVideo);
      }
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [slug, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  function canWatchVideo(video: Video): boolean {
    if (!course) return false;
    if (video.isFreePreview) return true;
    return course.hasAccess;
  }

  async function markWatched(videoId: string) {
    try {
      await request('PUT', `/api/academy/videos/${videoId}/progress`);
      if (course) {
        setCourse({
          ...course,
          watchedCount: course.watchedCount + 1,
          modules: course.modules.map((module) => ({
            ...module,
            videos: module.videos.map((video) => (video.id === videoId ? { ...video, watched: true } : video)),
          })),
        });
      }
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-[1200px] justify-center px-6 py-20">
        <Loader2 className="animate-spin text-wine" size={24} />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-20 text-center">
        <p className="text-lg text-stone-500" style={{ fontFamily: 'var(--font-serif)' }}>
          Curso no encontrado
        </p>
        <Link href="/academia" className="mt-4 inline-block text-sm text-wine transition-colors hover:text-wine-light">
          Volver a Academia
        </Link>
      </div>
    );
  }

  const youtubeId = activeVideo ? extractYoutubeId(activeVideo.youtubeUrl) : null;
  const progress = course.totalVideos > 0 ? (course.watchedCount / course.totalVideos) * 100 : 0;
  const isGranMayorCourse = course.baseTier === 'gran_mayor';
  const hasRealAccess = canAccessCourse(user, { isActive: true, baseTier: course.baseTier }) && course.hasAccess;
  const isBlockedByTier = !hasRealAccess;

  return (
    <>
      <section className="border-b border-stone-100 bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-10 sm:py-14">
          <Link
            href="/academia"
            className="mb-8 inline-flex items-center gap-2 text-[11px] font-light uppercase tracking-wide text-stone-400 transition-colors hover:text-wine"
          >
            <ArrowLeft size={14} /> Volver a Academia
          </Link>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="mb-3 flex flex-wrap items-center gap-2.5">
                <span className="rounded-full bg-wine/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-wine">
                  {ACCESS_LABELS[course.baseTier] || ACCESS_LABELS.por_mayor}
                </span>
                {course.hasAccess ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    Disponible
                  </span>
                ) : (
                  <span className="rounded-full bg-jeweler/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
                    Acceso restringido
                  </span>
                )}
              </div>

              <h1 className="mb-2 text-[clamp(1.8rem,3.5vw,2.8rem)] text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
                {course.title}
              </h1>
              <div className="flex items-center gap-4 text-[11px] font-light text-stone-400">
                <span>{course.modules.length} modulos</span>
                <span className="h-3 w-px bg-stone-200" />
                <span>{course.totalVideos} videos</span>
                {course.hasAccess && (
                  <>
                    <span className="h-3 w-px bg-stone-200" />
                    <span className="font-medium text-wine">
                      {course.watchedCount}/{course.totalVideos} completados
                    </span>
                  </>
                )}
              </div>
            </m.div>

            {course.hasAccess && (
              <div className="flex items-center gap-3 lg:flex-shrink-0">
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-wine transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[11px] font-light text-stone-400">{Math.round(progress)}%</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-ivory">
        <div className="mx-auto max-w-[1200px] px-6 py-10 sm:py-14">
          <div className={`grid gap-8 ${hasRealAccess ? 'lg:grid-cols-[1fr,380px]' : ''}`}>
            <div>
              {hasRealAccess && activeVideo && canWatchVideo(activeVideo) && youtubeId ? (
                <div className="mb-5 aspect-video overflow-hidden rounded-xl bg-black shadow-lg">
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : isBlockedByTier ? (
                <div className="mb-5 flex aspect-video flex-col items-center justify-center rounded-xl border border-stone-200 bg-white px-6 text-center shadow-luxury">
                  <Lock className="mb-3 text-stone-300" size={32} />
                  <p className="text-sm text-stone-500" style={{ fontFamily: 'var(--font-serif)' }}>
                    {isGranMayorCourse ? 'Este curso esta disponible para clientes Gran Mayor.' : 'Este curso es contenido premium'}
                  </p>
                  <p className="mt-2 max-w-md text-xs font-light leading-relaxed text-stone-500">
                    {isGranMayorCourse
                      ? 'Sube de nivel para acceder a este contenido exclusivo de Academia Dorella.'
                      : 'Este contenido esta disponible segun el nivel de acceso configurado para el curso.'}
                  </p>
                  {isGranMayorCourse && user?.tier === 'mayorista' && (
                    <a
                      href={WHATSAPP_UPGRADE_HREF}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 inline-flex items-center gap-2 rounded-full bg-wine px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-wine-light"
                    >
                      Quiero ser Gran Mayor
                      <ArrowRight size={14} />
                    </a>
                  )}
                </div>
              ) : (
                <div className="mb-5 flex aspect-video items-center justify-center rounded-xl border border-stone-200 bg-white shadow-luxury">
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-wine/10">
                      <GraduationCap className="text-wine/40" size={22} />
                    </div>
                    <p className="text-sm text-stone-500" style={{ fontFamily: 'var(--font-serif)' }}>
                      Selecciona un video para comenzar
                    </p>
                  </div>
                </div>
              )}

              {hasRealAccess && activeVideo && (
                <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                  <h2 className="text-lg text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
                    {activeVideo.title}
                  </h2>
                  {activeVideo.description && <p className="mt-2 text-sm font-light leading-relaxed text-stone-500">{activeVideo.description}</p>}
                  <div className="mt-4 flex items-center gap-4">
                    {activeVideo.duration && (
                      <span className="text-[11px] font-light text-stone-400">Duracion: {formatDuration(activeVideo.duration)}</span>
                    )}
                    {canWatchVideo(activeVideo) && !activeVideo.watched && (
                      <button
                        onClick={() => markWatched(activeVideo.id)}
                        className="flex cursor-pointer items-center gap-1.5 text-[11px] font-light text-stone-400 transition-colors hover:text-green-600"
                      >
                        <CheckCircle size={13} /> Marcar como visto
                      </button>
                    )}
                    {activeVideo.watched && (
                      <span className="flex items-center gap-1.5 text-[11px] font-light text-green-600">
                        <CheckCircle size={13} /> Visto
                      </span>
                    )}
                  </div>
                </m.div>
              )}
            </div>

            {hasRealAccess && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">Contenido del curso</h3>
                {course.modules.map((module) => (
                <div key={module.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-luxury">
                  <div className="border-b border-stone-100 px-4 py-3">
                    <span className="text-[13px] text-stone-700" style={{ fontFamily: 'var(--font-serif)' }}>
                      {module.title}
                    </span>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {module.videos.map((video) => {
                      const accessible = canWatchVideo(video);
                      const isActive = activeVideo?.id === video.id;
                      return (
                        <button
                          key={video.id}
                          onClick={() => accessible && setActiveVideo(video)}
                          disabled={!accessible}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                            isActive ? 'bg-wine/[0.04]' : accessible ? 'cursor-pointer hover:bg-stone-50' : 'cursor-not-allowed opacity-50'
                          }`}
                        >
                          {video.watched ? (
                            <CheckCircle size={14} className="flex-shrink-0 text-green-500" />
                          ) : accessible ? (
                            <Play size={14} className="flex-shrink-0 text-wine" />
                          ) : (
                            <Lock size={14} className="flex-shrink-0 text-stone-300" />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className={`block truncate text-[12px] ${isActive ? 'font-medium text-wine' : 'text-stone-600'}`}>{video.title}</span>
                            {video.duration && <span className="text-[10px] font-light text-stone-400">{formatDuration(video.duration)}</span>}
                          </div>
                          {video.isFreePreview && <span className="flex-shrink-0 text-[9px] font-medium text-green-600">Free</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
