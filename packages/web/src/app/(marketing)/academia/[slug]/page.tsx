'use client';

import { useState, useEffect, useCallback } from 'react';
import { request } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/context/ToastProvider';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, CheckCircle, Lock, Loader2, GraduationCap, Unlock } from 'lucide-react';
import { motion } from 'framer-motion';

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
  unlockPrice: number;
  hasAccess: boolean;
  watchedCount: number;
  totalVideos: number;
  modules: Module[];
}

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
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request('GET', `/api/academy/courses/${slug}`);
      if (res.success) {
        setCourse(res.data);
        const firstFree = res.data.modules
          ?.flatMap((m: Module) => m.videos)
          .find((v: Video) => v.isFreePreview || res.data.hasAccess);
        if (firstFree) setActiveVideo(firstFree);
      }
    } catch (e) { showToast((e as Error).message, 'error'); }
    finally { setLoading(false); }
  }, [slug, showToast]);

  useEffect(() => { load(); }, [load]);

  function canWatchVideo(v: Video): boolean {
    if (!course) return false;
    if (v.isFreePreview) return true;
    if (course.hasAccess) return true;
    return false;
  }

  async function handleUnlock() {
    if (!course || !user) return;
    setUnlocking(true);
    try {
      const res = await request('POST', `/api/academy/courses/${course.id}/unlock`);
      if (res.success) {
        showToast(`Orden ${res.data.orderNumber} creada. Confirma el pago para acceder.`, 'success');
        await request('POST', `/api/academy/courses/${course.id}/confirm-unlock`, { orderId: res.data.orderId });
        showToast('¡Acceso desbloqueado!');
        load();
      }
    } catch (e) { showToast((e as Error).message, 'error'); }
    finally { setUnlocking(false); }
  }

  async function markWatched(videoId: string) {
    try {
      await request('PUT', `/api/academy/videos/${videoId}/progress`);
      if (course) {
        setCourse({
          ...course,
          watchedCount: course.watchedCount + 1,
          modules: course.modules.map((m) => ({
            ...m,
            videos: m.videos.map((v) => v.id === videoId ? { ...v, watched: true } : v),
          })),
        });
      }
    } catch { /* ignore */ }
  }

  if (loading) return (
    <div className="max-w-[1200px] mx-auto px-6 py-20 flex justify-center">
      <Loader2 className="animate-spin text-wine" size={24} />
    </div>
  );

  if (!course) return (
    <div className="max-w-[1200px] mx-auto px-6 py-20 text-center">
      <p className="text-lg text-stone-500" style={{ fontFamily: 'var(--font-serif)' }}>Curso no encontrado</p>
      <Link href="/academia" className="text-sm text-wine mt-4 inline-block hover:text-wine-light transition-colors">
        Volver a Academia
      </Link>
    </div>
  );

  const youtubeId = activeVideo ? extractYoutubeId(activeVideo.youtubeUrl) : null;
  const progress = course.totalVideos > 0 ? (course.watchedCount / course.totalVideos) * 100 : 0;

  return (
    <>
      {/* Course Header */}
      <section className="bg-white border-b border-stone-100">
        <div className="max-w-[1200px] mx-auto px-6 py-10 sm:py-14">
          {/* Back link */}
          <Link href="/academia"
            className="inline-flex items-center gap-2 text-[11px] text-stone-400 hover:text-wine transition-colors mb-8 font-light tracking-wide uppercase">
            <ArrowLeft size={14} /> Volver a Academia
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <h1 className="text-[clamp(1.8rem,3.5vw,2.8rem)] text-stone-800 mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
                {course.title}
              </h1>
              <div className="flex items-center gap-4 text-[11px] text-stone-400 font-light">
                <span>{course.modules.length} módulos</span>
                <span className="w-px h-3 bg-stone-200" />
                <span>{course.totalVideos} videos</span>
                {course.hasAccess && (
                  <>
                    <span className="w-px h-3 bg-stone-200" />
                    <span className="text-wine font-medium">{course.watchedCount}/{course.totalVideos} completados</span>
                  </>
                )}
              </div>
            </motion.div>

            {course.hasAccess && (
              <div className="flex items-center gap-3 lg:flex-shrink-0">
                <div className="w-32 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-wine rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[11px] text-stone-400 font-light">{Math.round(progress)}%</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="bg-ivory">
        <div className="max-w-[1200px] mx-auto px-6 py-10 sm:py-14">
          <div className="grid lg:grid-cols-[1fr,380px] gap-8">
            {/* Player / Content area */}
            <div>
              {activeVideo && canWatchVideo(activeVideo) && youtubeId ? (
                <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-lg mb-5">
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : activeVideo && !canWatchVideo(activeVideo) ? (
                <div className="aspect-video bg-white rounded-xl flex flex-col items-center justify-center mb-5 border border-stone-200 shadow-luxury">
                  <Lock className="text-stone-300 mb-3" size={32} />
                  <p className="text-sm text-stone-500 mb-4" style={{ fontFamily: 'var(--font-serif)' }}>
                    Este video es contenido premium
                  </p>
                  <button onClick={handleUnlock} disabled={unlocking}
                    className="btn-primary flex items-center gap-2 px-6 py-3 bg-wine text-white rounded-lg text-sm font-medium hover:bg-wine-light transition-colors disabled:opacity-50 cursor-pointer tracking-wide">
                    {unlocking ? <Loader2 className="animate-spin" size={16} /> : <Unlock size={16} />}
                    Desbloquear curso · {Number(course.unlockPrice).toLocaleString('es-CO')} COP
                  </button>
                </div>
              ) : (
                <div className="aspect-video bg-white rounded-xl flex items-center justify-center mb-5 border border-stone-200 shadow-luxury">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-wine/10 flex items-center justify-center mx-auto mb-3">
                      <GraduationCap className="text-wine/40" size={22} />
                    </div>
                    <p className="text-sm text-stone-500" style={{ fontFamily: 'var(--font-serif)' }}>
                      Selecciona un video para comenzar
                    </p>
                  </div>
                </div>
              )}

              {activeVideo && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                  <h2 className="text-lg text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
                    {activeVideo.title}
                  </h2>
                  {activeVideo.description && (
                    <p className="text-sm text-stone-500 mt-2 font-light leading-relaxed">{activeVideo.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-4">
                    {activeVideo.duration && (
                      <span className="text-[11px] text-stone-400 font-light">
                        Duración: {formatDuration(activeVideo.duration)}
                      </span>
                    )}
                    {canWatchVideo(activeVideo) && !activeVideo.watched && (
                      <button onClick={() => markWatched(activeVideo.id)}
                        className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-green-600 transition-colors cursor-pointer font-light">
                        <CheckCircle size={13} /> Marcar como visto
                      </button>
                    )}
                    {activeVideo.watched && (
                      <span className="flex items-center gap-1.5 text-[11px] text-green-600 font-light">
                        <CheckCircle size={13} /> Visto
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Sidebar: Module list */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">Contenido del curso</h3>
              {course.modules.map((m) => (
                <div key={m.id} className="bg-white border border-stone-200 rounded-lg overflow-hidden shadow-luxury">
                  <div className="px-4 py-3 border-b border-stone-100">
                    <span className="text-[13px] text-stone-700" style={{ fontFamily: 'var(--font-serif)' }}>{m.title}</span>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {m.videos.map((v) => {
                      const accessible = canWatchVideo(v);
                      const isActive = activeVideo?.id === v.id;
                      return (
                        <button key={v.id} onClick={() => accessible && setActiveVideo(v)}
                          disabled={!accessible}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            isActive ? 'bg-wine/[0.04]' : accessible ? 'hover:bg-stone-50 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                          }`}>
                          {v.watched ? (
                            <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                          ) : accessible ? (
                            <Play size={14} className="text-wine flex-shrink-0" />
                          ) : (
                            <Lock size={14} className="text-stone-300 flex-shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className={`text-[12px] truncate block ${isActive ? 'text-wine font-medium' : 'text-stone-600'}`}>
                              {v.title}
                            </span>
                            {v.duration && (
                              <span className="text-[10px] text-stone-400 font-light">{formatDuration(v.duration)}</span>
                            )}
                          </div>
                          {v.isFreePreview && (
                            <span className="text-[9px] text-green-600 flex-shrink-0 font-medium">Free</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
