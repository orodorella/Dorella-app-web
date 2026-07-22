'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { request } from '@/hooks/useApi';
import { useToast } from '@/context/ToastProvider';
import { useRouter } from 'next/navigation';
import { GraduationCap, Plus, Edit, Trash2, Loader2, BookOpen, Users, LayoutDashboard, Upload, X } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  baseTier: string;
  unlockPrice: number;
  isActive: boolean;
  order: number;
  imageUrl: string | null;
  _count: { modules: number; accesses: number };
}

const TIER_LABELS: Record<string, string> = {
  detal: 'Detal',
  por_mayor: 'Mayorista',
  gran_mayor: 'Gran Mayorista',
};

export default function AdminAcademiaPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', slug: '', description: '', imageUrl: '', baseTier: 'detal', unlockPrice: '0', order: '0',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request('GET', '/api/admin/academy/courses');
      if (res.success) setCourses(res.data);
    } catch (e) { showToast((e as Error).message, 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ title: '', slug: '', description: '', imageUrl: '', baseTier: 'detal', unlockPrice: '0', order: '0' });
    setImageFile(null);
    setImagePreview('');
    setShowForm(true);
  }

  function openEdit(c: Course) {
    setEditing(c);
    setForm({
      title: c.title, slug: c.slug, description: c.description || '', imageUrl: c.imageUrl || '',
      baseTier: c.baseTier, unlockPrice: String(c.unlockPrice), order: String(c.order),
    });
    setImageFile(null);
    setImagePreview('');
    setShowForm(true);
  }

  async function uploadImage(courseId: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`/api/admin/academy/courses/${courseId}/image`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error subiendo imagen');
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Error subiendo imagen');
    return data.data.imageUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        title: form.title,
        slug: form.slug,
        description: form.description || undefined,
        imageUrl: form.imageUrl || undefined,
        baseTier: form.baseTier as any,
        unlockPrice: Number(form.unlockPrice),
        order: Number(form.order),
      };
      if (editing) {
        if (imageFile) {
          setImageUploading(true);
          try {
            const imageUrl = await uploadImage(editing.id, imageFile);
            data.imageUrl = imageUrl;
          } finally { setImageUploading(false); }
        }
        await request('PUT', `/api/admin/academy/courses/${editing.id}`, data);
        showToast('Curso actualizado');
      } else {
        const res = await request('POST', '/api/admin/academy/courses', data);
        if (res.success && imageFile) {
          setImageUploading(true);
          try {
            await uploadImage(res.data.id, imageFile);
          } finally { setImageUploading(false); }
        }
        showToast('Curso creado');
      }
      setShowForm(false);
      load();
    } catch (e) { showToast((e as Error).message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setConfirmDeleteId(id);
  }

  async function confirmDeleteCourse() {
    if (!confirmDeleteId) return;
    try {
      await request('DELETE', `/api/admin/academy/courses/${confirmDeleteId}`);
      showToast('Curso eliminado');
      load();
    } catch (e) { showToast((e as Error).message, 'error'); }
    finally { setConfirmDeleteId(null); }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Formato no válido (jpg, png, webp)', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('La imagen no puede superar 5MB', 'error');
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = '';
  }

  function removeImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview('');
    setForm({ ...form, imageUrl: '' });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl text-stone-800 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Academia</h1>
          <p className="text-sm text-stone-400">Gestion de cursos y contenido</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-wine text-white rounded-lg text-sm font-medium hover:bg-wine-light transition-colors cursor-pointer">
          <Plus size={16} /> Nuevo Curso
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-wine" size={24} /></div>
      ) : courses.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-sm">
          No hay cursos creados. Crea tu primer curso para comenzar.
        </div>
      ) : (
        <div className="grid gap-4">
          {courses.map((c) => (
            <div key={c.id} className="bg-white border border-stone-200 rounded-lg p-5 flex items-center justify-between hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-4 min-w-0">
                {c.imageUrl ? (
                  <img src={c.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover bg-stone-50" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-wine/5 flex items-center justify-center">
                    <GraduationCap className="text-wine/40" size={24} />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-[15px] text-stone-800 truncate" style={{ fontFamily: 'var(--font-serif)' }}>{c.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-stone-400">
                    <span className="flex items-center gap-1"><BookOpen size={12} /> {c._count.modules} módulos</span>
                    <span className="flex items-center gap-1"><Users size={12} /> {c._count.accesses} accesos</span>
                    <span className="px-2 py-0.5 rounded-full bg-wine/10 text-wine font-medium">{TIER_LABELS[c.baseTier]}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(c)}
                  className="p-2 text-stone-400 hover:text-wine transition-colors cursor-pointer" title="Editar info">
                  <Edit size={16} />
                </button>
                <button onClick={() => router.push(`/admin/academia/${c.id}`)}
                  className="p-2 text-stone-400 hover:text-wine transition-colors cursor-pointer" title="Gestionar contenido">
                  <LayoutDashboard size={16} />
                </button>
                <button onClick={() => handleDelete(c.id)}
                  className="p-2 text-stone-400 hover:text-red-500 transition-colors cursor-pointer" title="Eliminar">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg text-stone-800 mb-4" style={{ fontFamily: 'var(--font-serif)' }}>{editing ? 'Editar Curso' : 'Nuevo Curso'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Título</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Slug</label>
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Descripción</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20" rows={3} />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Imagen del curso</label>
                {imagePreview || form.imageUrl ? (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-stone-100 group">
                    <img src={imagePreview || form.imageUrl} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={removeImage}
                      className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <X size={14} />
                    </button>
                    {imageFile && (
                      <span className="absolute bottom-2 left-2 bg-amber-500/80 text-white text-[10px] px-2 py-0.5 rounded">Nueva imagen</span>
                    )}
                  </div>
                ) : (
                  <div onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-stone-200 hover:border-stone-300 rounded-lg p-6 text-center cursor-pointer transition-colors">
                    <div className="flex flex-col items-center gap-2 text-stone-400">
                      <Upload size={20} />
                      <p className="text-sm">Arrastra una imagen o haz click</p>
                      <p className="text-[10px] text-stone-300">JPG, PNG o WebP — Máx 5MB</p>
                    </div>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageSelect} className="hidden" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Tier base</label>
                  <select value={form.baseTier} onChange={(e) => setForm({ ...form, baseTier: e.target.value })}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20">
                    <option value="detal">Detal</option>
                    <option value="por_mayor">Mayorista</option>
                    <option value="gran_mayor">Gran Mayorista</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Precio desbloqueo</label>
                  <input type="number" value={form.unlockPrice} onChange={(e) => setForm({ ...form, unlockPrice: e.target.value })}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Orden</label>
                  <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving || imageUploading}
                  className="flex-1 bg-wine text-white rounded-lg py-2 text-sm font-medium hover:bg-wine-light transition-colors disabled:opacity-50 cursor-pointer">
                  {(saving || imageUploading) ? <Loader2 className="animate-spin mx-auto" size={16} /> : editing ? 'Guardar cambios' : 'Crear curso'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Eliminar curso"
        message="¿Eliminar este curso y todo su contenido? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        onConfirm={confirmDeleteCourse}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
