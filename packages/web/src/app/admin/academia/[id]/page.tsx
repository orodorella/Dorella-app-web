'use client';

import { useState, useEffect, useCallback } from 'react';
import { request } from '@/hooks/useApi';
import { useToast } from '@/context/ToastProvider';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Edit, Trash2, Loader2, GripVertical, Play, ExternalLink, GraduationCap } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface Video { id: string; title: string; youtubeUrl: string; duration: number | null; isFreePreview: boolean; order: number; description: string | null; }
interface Module { id: string; title: string; order: number; description: string | null; videos: Video[]; }
interface Course { id: string; title: string; slug: string; description: string | null; imageUrl: string | null; baseTier: string; unlockPrice: number; modules: Module[]; }

const TIER_LABELS: Record<string, string> = {
  detal: 'Detal',
  por_mayor: 'Mayorista',
  gran_mayor: 'Gran Mayorista',
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
    } catch (e) { showToast((e as Error).message, 'error'); }
    finally { setLoading(false); }
  }, [courseId, showToast]);

  useEffect(() => { load(); }, [load]);

  // ── Module CRUD ───────────────────────────────────────────────────

  function openCreateModule() {
    setEditingModule(null);
    setModuleForm({ title: '', description: '' });
    setShowModuleForm(true);
  }

  function openEditModule(m: Module) {
    setEditingModule(m);
    setModuleForm({ title: m.title, description: m.description || '' });
    setShowModuleForm(true);
  }

  async function handleModuleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingModule) {
        await request('PUT', `/api/admin/academy/modules/${editingModule.id}`, moduleForm);
        showToast('Módulo actualizado');
      } else {
        await request('POST', `/api/admin/academy/courses/${courseId}/modules`, moduleForm);
        showToast('Módulo creado');
      }
      setShowModuleForm(false);
      load();
    } catch (e) { showToast((e as Error).message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleDeleteModule(id: string) {
    setConfirmDelete({ type: 'module', id });
  }

  async function confirmDeleteAction() {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.type === 'module') {
        await request('DELETE', `/api/admin/academy/modules/${confirmDelete.id}`);
        showToast('Módulo eliminado');
      } else {
        await request('DELETE', `/api/admin/academy/videos/${confirmDelete.id}`);
        showToast('Video eliminado');
      }
      load();
    } catch (e) { showToast((e as Error).message, 'error'); }
    finally { setConfirmDelete(null); }
  }

  // ── Video CRUD ────────────────────────────────────────────────────

  function openCreateVideo(moduleId: string) {
    setActiveModuleId(moduleId);
    setEditingVideo(null);
    setVideoForm({ title: '', youtubeUrl: '', description: '', isFreePreview: false });
    setShowVideoForm(true);
  }

  function openEditVideo(v: Video, moduleId: string) {
    setActiveModuleId(moduleId);
    setEditingVideo(v);
    setVideoForm({
      title: v.title, youtubeUrl: v.youtubeUrl, description: v.description || '',
      isFreePreview: v.isFreePreview,
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
    } catch (e) { showToast((e as Error).message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleDeleteVideo(id: string) {
    setConfirmDelete({ type: 'video', id });
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-wine" size={24} /></div>;
  if (!course) return <div className="text-center py-12 text-stone-400">Curso no encontrado</div>;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button onClick={() => router.push('/admin/academia')}
        className="inline-flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-wine transition-colors font-light tracking-wide cursor-pointer">
        <ArrowLeft size={14} /> volver a academia
      </button>

      {/* Course Header */}
      <div className="bg-white border border-stone-200 rounded-lg p-5">
        <div className="flex gap-5">
          {course.imageUrl ? (
            <img src={course.imageUrl} alt={course.title}
              className="w-60 aspect-video rounded-lg object-cover bg-stone-50 flex-shrink-0" />
          ) : (
            <div className="w-60 aspect-video rounded-lg bg-wine/5 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="text-wine/30" size={32} />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>{course.title}</h1>
            {course.description && (
              <p className="text-sm text-stone-500 mt-1.5 font-light leading-relaxed line-clamp-2">{course.description}</p>
            )}
            <div className="flex items-center gap-2.5 mt-3">
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-wine/10 text-wine font-medium">
                {TIER_LABELS[course.baseTier]}
              </span>
              <span className="text-[11px] text-stone-400 font-light">
                {course.modules.length} módulos · {course.modules.reduce((acc, m) => acc + m.videos.length, 0)} videos
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Modules section */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>Módulos</h2>
        <button onClick={openCreateModule}
          className="flex items-center gap-2 px-4 py-2 bg-wine text-white rounded-lg text-sm font-medium hover:bg-wine-light transition-colors cursor-pointer">
          <Plus size={16} /> Módulo
        </button>
      </div>

      {course.modules.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-sm border border-dashed border-stone-200 rounded-lg">
          No hay módulos. Crea el primer módulo para agregar videos.
        </div>
      ) : (
        <div className="space-y-4">
          {course.modules.map((m) => (
            <div key={m.id} className="bg-white border border-stone-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-stone-50 border-b border-stone-100">
                <div className="flex items-center gap-3 min-w-0">
                  <GripVertical size={14} className="text-stone-300 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium text-sm text-stone-700">{m.title}</span>
                    {m.description && (
                      <p className="text-[11px] text-stone-400 font-light truncate">{m.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-stone-400 flex-shrink-0">{m.videos.length} videos</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openCreateVideo(m.id)}
                    className="p-1.5 text-stone-400 hover:text-wine transition-colors cursor-pointer" title="Agregar video">
                    <Plus size={14} />
                  </button>
                  <button onClick={() => openEditModule(m)}
                    className="p-1.5 text-stone-400 hover:text-wine transition-colors cursor-pointer" title="Editar módulo">
                    <Edit size={14} />
                  </button>
                  <button onClick={() => handleDeleteModule(m.id)}
                    className="p-1.5 text-stone-400 hover:text-red-500 transition-colors cursor-pointer" title="Eliminar módulo">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {m.videos.length === 0 ? (
                <div className="px-5 py-4 text-xs text-stone-400">Sin videos</div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {m.videos.map((v) => {
                    const ytId = extractYoutubeId(v.youtubeUrl);
                    return (
                      <div key={v.id} className="group/video">
                        <div className="flex items-center justify-between px-5 py-3 group-hover/video:bg-wine/[0.03] transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <Play size={14} className="text-wine flex-shrink-0" />
                            <span className="text-sm text-stone-700 truncate">{v.title}</span>
                            {v.isFreePreview && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded font-medium">Gratis</span>
                            )}
                            {v.duration && (
                              <span className="text-[10px] text-stone-400">{Math.floor(v.duration / 60)}:{(v.duration % 60).toString().padStart(2, '0')}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditVideo(v, m.id)}
                              className="p-1.5 text-stone-400 hover:text-wine transition-colors cursor-pointer">
                              <Edit size={14} />
                            </button>
                            <button onClick={() => handleDeleteVideo(v.id)}
                              className="p-1.5 text-stone-400 hover:text-red-500 transition-colors cursor-pointer">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="hidden group-hover/video:block">
                          <div className="px-5 py-4 bg-stone-50/50 border-t border-stone-100">
                            <div className="flex gap-4">
                              {ytId ? (
                                <img
                                  src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                                  alt={v.title}
                                  className="w-48 aspect-video rounded-lg object-cover bg-stone-200 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-48 aspect-video rounded-lg bg-stone-200 flex items-center justify-center flex-shrink-0">
                                  <Play size={20} className="text-stone-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-stone-700 font-medium">{v.title}</p>
                                {v.description && (
                                  <p className="text-xs text-stone-400 mt-1 line-clamp-2">{v.description}</p>
                                )}
                                <div className="flex items-center gap-3 mt-3">
                                  {v.duration && (
                                    <span className="text-[11px] text-stone-400">
                                      Duración: {Math.floor(v.duration / 60)}:{(v.duration % 60).toString().padStart(2, '0')}
                                    </span>
                                  )}
                                  {v.isFreePreview && (
                                    <span className="text-[11px] text-green-600 font-medium">Vista previa gratuita</span>
                                  )}
                                </div>
                                {ytId && (
                                  <a href={v.youtubeUrl} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 mt-3 text-[11px] text-wine hover:text-wine-light transition-colors">
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

      {/* Module Form Modal */}
      {showModuleForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowModuleForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg text-stone-800 mb-4" style={{ fontFamily: 'var(--font-serif)' }}>{editingModule ? 'Editar Módulo' : 'Nuevo Módulo'}</h2>
            <form onSubmit={handleModuleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Título</label>
                <input value={moduleForm.title} onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} required
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Descripción</label>
                <textarea value={moduleForm.description} onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20" rows={2} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-wine text-white rounded-lg py-2 text-sm font-medium hover:bg-wine-light transition-colors disabled:opacity-50 cursor-pointer">
                  {saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Guardar'}
                </button>
                <button type="button" onClick={() => setShowModuleForm(false)}
                  className="px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50 cursor-pointer">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Video Form Modal */}
      {showVideoForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowVideoForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg text-stone-800 mb-4" style={{ fontFamily: 'var(--font-serif)' }}>{editingVideo ? 'Editar Video' : 'Nuevo Video'}</h2>
            <form onSubmit={handleVideoSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Título</label>
                <input value={videoForm.title} onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })} required
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">URL de YouTube</label>
                <input value={videoForm.youtubeUrl} onChange={(e) => setVideoForm({ ...videoForm, youtubeUrl: e.target.value })} required
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Descripción</label>
                <textarea value={videoForm.description} onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20" rows={2} />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                  <input type="checkbox" checked={videoForm.isFreePreview} onChange={(e) => setVideoForm({ ...videoForm, isFreePreview: e.target.checked })}
                    className="rounded border-stone-300 text-wine focus:ring-wine/20" />
                  Vista previa gratis
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-wine text-white rounded-lg py-2 text-sm font-medium hover:bg-wine-light transition-colors disabled:opacity-50 cursor-pointer">
                  {saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Guardar'}
                </button>
                <button type="button" onClick={() => setShowVideoForm(false)}
                  className="px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50 cursor-pointer">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.type === 'module' ? 'Eliminar módulo' : 'Eliminar video'}
        message={confirmDelete?.type === 'module'
          ? '¿Eliminar este módulo y todos sus videos? Esta acción no se puede deshacer.'
          : '¿Eliminar este video? Esta acción no se puede deshacer.'}
        confirmLabel="Eliminar"
        danger
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
