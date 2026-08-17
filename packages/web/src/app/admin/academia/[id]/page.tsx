'use client';

import { useState, useEffect, useCallback } from 'react';
import { request } from '@/hooks/useApi';
import { useToast } from '@/context/ToastProvider';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Edit, Trash2, Loader2, GripVertical, Play, ExternalLink, GraduationCap } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface Video {
  id: string;
  title: string;
  youtubeUrl: string;
  duration: number | null;
  isFreePreview: boolean;
  order: number;
  description: string | null;
}

interface Module {
  id: string;
  title: string;
  order: number;
  description: string | null;
  videos: Video[];
}

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  baseTier: string;
  isActive?: boolean;
  modules: Module[];
}

const ACCESS_LABELS: Record<string, string> = {
  detal: 'Por Mayor + Gran Mayor',
  por_mayor: 'Por Mayor + Gran Mayor',
  gran_mayor: 'Solo Gran Mayor',
};

export default function AdminCourseDetailPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' });
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [videoForm, setVideoForm] = useState({ title: '', youtubeUrl: '', description: '', isFreePreview: false });
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'module' | 'video'; id: string } | null>(null);

  function extractYoutubeId(url: string): string | null {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&?#]+)/);
    return match ? match[1] : null;
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request('GET', `/api/admin/academy/courses/${courseId}`);
      if (res.success) setCourse(res.data);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [courseId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreateModule() {
    setEditingModule(null);
    setModuleForm({ title: '', description: '' });
    setShowModuleForm(true);
  }

  function openEditModule(module: Module) {
    setEditingModule(module);
    setModuleForm({ title: module.title, description: module.description || '' });
    setShowModuleForm(true);
  }

  async function handleModuleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingModule) {
        await request('PUT', `/api/admin/academy/modules/${editingModule.id}`, moduleForm);
        showToast('Modulo actualizado');
      } else {
        await request('POST', `/api/admin/academy/courses/${courseId}/modules`, moduleForm);
        showToast('Modulo creado');
      }
      setShowModuleForm(false);
      load();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteModule(id: string) {
    setConfirmDelete({ type: 'module', id });
  }

  async function confirmDeleteAction() {
    if (!confirmDelete) return;

    try {
      if (confirmDelete.type === 'module') {
        await request('DELETE', `/api/admin/academy/modules/${confirmDelete.id}`);
        showToast('Modulo eliminado');
      } else {
        await request('DELETE', `/api/admin/academy/videos/${confirmDelete.id}`);
        showToast('Video eliminado');
      }
      load();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setConfirmDelete(null);
    }
  }

  function openCreateVideo(moduleId: string) {
    setActiveModuleId(moduleId);
    setEditingVideo(null);
    setVideoForm({ title: '', youtubeUrl: '', description: '', isFreePreview: false });
    setShowVideoForm(true);
  }

  function openEditVideo(video: Video, moduleId: string) {
    setActiveModuleId(moduleId);
    setEditingVideo(video);
    setVideoForm({
      title: video.title,
      youtubeUrl: video.youtubeUrl,
      description: video.description || '',
      isFreePreview: video.isFreePreview,
    });
    setShowVideoForm(true);
  }

  async function handleVideoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeModuleId) return;

    setSaving(true);
    try {
      const data = {
        title: videoForm.title,
        youtubeUrl: videoForm.youtubeUrl,
        description: videoForm.description || undefined,
        isFreePreview: videoForm.isFreePreview,
      };

      if (editingVideo) {
        await request('PUT', `/api/admin/academy/videos/${editingVideo.id}`, data);
        showToast('Video actualizado');
      } else {
        await request('POST', `/api/admin/academy/modules/${activeModuleId}/videos`, data);
        showToast('Video creado');
      }

      setShowVideoForm(false);
      load();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteVideo(id: string) {
    setConfirmDelete({ type: 'video', id });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-wine" size={24} />
      </div>
    );
  }

  if (!course) {
    return <div className="py-12 text-center text-stone-400">Curso no encontrado</div>;
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push('/admin/academia')}
        className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-light tracking-wide text-stone-400 transition-colors hover:text-wine"
      >
        <ArrowLeft size={14} /> volver a academia
      </button>

      <div className="rounded-lg border border-stone-200 bg-white p-5">
        <div className="flex gap-5">
          {course.imageUrl ? (
            <img src={course.imageUrl} alt={course.title} className="aspect-video w-60 flex-shrink-0 rounded-lg bg-stone-50 object-cover" />
          ) : (
            <div className="flex aspect-video w-60 flex-shrink-0 items-center justify-center rounded-lg bg-wine/5">
              <GraduationCap className="text-wine/30" size={32} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
              {course.title}
            </h1>
            {course.description && (
              <p className="mt-1.5 line-clamp-2 text-sm font-light leading-relaxed text-stone-500">{course.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <span className="rounded-full bg-wine/10 px-2.5 py-1 text-[11px] font-medium text-wine">
                {ACCESS_LABELS[course.baseTier] || ACCESS_LABELS.por_mayor}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  course.isActive === false ? 'bg-stone-100 text-stone-500' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {course.isActive === false ? 'Oculto' : 'Visible'}
              </span>
              <span className="text-[11px] font-light text-stone-400">
                {course.modules.length} módulos · {course.modules.reduce((acc, module) => acc + module.videos.length, 0)} videos
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
          Modulos
        </h2>
        <button
          onClick={openCreateModule}
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-wine px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-wine-light"
        >
          <Plus size={16} /> Modulo
        </button>
      </div>

      {course.modules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-200 py-12 text-center text-sm text-stone-400">
          No hay módulos. Crea el primero para agregar videos.
        </div>
      ) : (
        <div className="space-y-4">
          {course.modules.map((module) => (
            <div key={module.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <GripVertical size={14} className="flex-shrink-0 text-stone-300" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-stone-700">{module.title}</span>
                    {module.description && <p className="truncate text-[11px] font-light text-stone-400">{module.description}</p>}
                  </div>
                  <span className="flex-shrink-0 text-xs text-stone-400">{module.videos.length} videos</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openCreateVideo(module.id)}
                    className="cursor-pointer p-1.5 text-stone-400 transition-colors hover:text-wine"
                    title="Agregar video"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => openEditModule(module)}
                    className="cursor-pointer p-1.5 text-stone-400 transition-colors hover:text-wine"
                    title="Editar modulo"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteModule(module.id)}
                    className="cursor-pointer p-1.5 text-stone-400 transition-colors hover:text-red-500"
                    title="Eliminar modulo"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {module.videos.length === 0 ? (
                <div className="px-5 py-4 text-xs text-stone-400">Sin videos</div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {module.videos.map((video) => {
                    const ytId = extractYoutubeId(video.youtubeUrl);
                    return (
                      <div key={video.id} className="group/video">
                        <div className="flex items-center justify-between px-5 py-3 transition-colors group-hover/video:bg-wine/[0.03]">
                          <div className="flex min-w-0 items-center gap-3">
                            <Play size={14} className="flex-shrink-0 text-wine" />
                            <span className="truncate text-sm text-stone-700">{video.title}</span>
                            {video.isFreePreview && (
                              <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-600">Gratis</span>
                            )}
                            {video.duration && (
                              <span className="text-[10px] text-stone-400">
                                {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditVideo(video, module.id)}
                              className="cursor-pointer p-1.5 text-stone-400 transition-colors hover:text-wine"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteVideo(video.id)}
                              className="cursor-pointer p-1.5 text-stone-400 transition-colors hover:text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="hidden group-hover/video:block">
                          <div className="border-t border-stone-100 bg-stone-50/50 px-5 py-4">
                            <div className="flex gap-4">
                              {ytId ? (
                                <img
                                  src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                                  alt={video.title}
                                  className="aspect-video w-48 flex-shrink-0 rounded-lg bg-stone-200 object-cover"
                                />
                              ) : (
                                <div className="flex aspect-video w-48 flex-shrink-0 items-center justify-center rounded-lg bg-stone-200">
                                  <Play size={20} className="text-stone-400" />
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-stone-700">{video.title}</p>
                                {video.description && <p className="mt-1 line-clamp-2 text-xs text-stone-400">{video.description}</p>}
                                <div className="mt-3 flex items-center gap-3">
                                  {video.duration && (
                                    <span className="text-[11px] text-stone-400">
                                      Duracion: {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                                    </span>
                                  )}
                                  {video.isFreePreview && (
                                    <span className="text-[11px] font-medium text-green-600">Vista previa gratuita</span>
                                  )}
                                </div>
                                {ytId && (
                                  <a
                                    href={video.youtubeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-wine transition-colors hover:text-wine-light"
                                  >
                                    <ExternalLink size={12} /> Ver en YouTube
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModuleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModuleForm(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
              {editingModule ? 'Editar modulo' : 'Nuevo modulo'}
            </h2>
            <form onSubmit={handleModuleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-500">Título</label>
                <input
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                  required
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-500">Descripción</label>
                <textarea
                  value={moduleForm.description}
                  onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 cursor-pointer rounded-lg bg-wine py-2 text-sm font-medium text-white transition-colors hover:bg-wine-light disabled:opacity-50"
                >
                  {saving ? <Loader2 className="mx-auto animate-spin" size={16} /> : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModuleForm(false)}
                  className="cursor-pointer rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showVideoForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowVideoForm(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
              {editingVideo ? 'Editar video' : 'Nuevo video'}
            </h2>
            <form onSubmit={handleVideoSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-500">Título</label>
                <input
                  value={videoForm.title}
                  onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                  required
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-500">URL de YouTube</label>
                <input
                  value={videoForm.youtubeUrl}
                  onChange={(e) => setVideoForm({ ...videoForm, youtubeUrl: e.target.value })}
                  required
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-500">Descripción</label>
                <textarea
                  value={videoForm.description}
                  onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20"
                />
              </div>
              <div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600">
                  <input
                    type="checkbox"
                    checked={videoForm.isFreePreview}
                    onChange={(e) => setVideoForm({ ...videoForm, isFreePreview: e.target.checked })}
                    className="rounded border-stone-300 text-wine focus:ring-wine/20"
                  />
                  Vista previa gratis
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 cursor-pointer rounded-lg bg-wine py-2 text-sm font-medium text-white transition-colors hover:bg-wine-light disabled:opacity-50"
                >
                  {saving ? <Loader2 className="mx-auto animate-spin" size={16} /> : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowVideoForm(false)}
                  className="cursor-pointer rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.type === 'module' ? 'Eliminar modulo' : 'Eliminar video'}
        message={
          confirmDelete?.type === 'module'
            ? '¿Eliminar este módulo y todos sus videos? Esta acción no se puede deshacer.'
            : '¿Eliminar este video? Esta acción no se puede deshacer.'
        }
        confirmLabel="Eliminar"
        danger
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
