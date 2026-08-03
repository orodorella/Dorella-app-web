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
  isActive: boolean;
  order: number;
  imageUrl: string | null;
  _count: { modules: number; accesses: number };
}

const ACCESS_LABELS: Record<string, string> = {
  detal: 'Por Mayor + Gran Mayor',
  por_mayor: 'Por Mayor + Gran Mayor',
  gran_mayor: 'Solo Gran Mayor',
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
    title: '',
    slug: '',
    description: '',
    imageUrl: '',
    baseTier: 'por_mayor',
    isActive: true,
    order: '0',
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
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setForm({
      title: '',
      slug: '',
      description: '',
      imageUrl: '',
      baseTier: 'por_mayor',
      isActive: true,
      order: '0',
    });
    setImageFile(null);
    setImagePreview('');
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setShowForm(true);
  }

  function openEdit(course: Course) {
    setEditing(course);
    setForm({
      title: course.title,
      slug: course.slug,
      description: course.description || '',
      imageUrl: course.imageUrl || '',
      baseTier: course.baseTier === 'gran_mayor' ? 'gran_mayor' : 'por_mayor',
      isActive: course.isActive,
      order: String(course.order),
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
        baseTier: form.baseTier,
        isActive: form.isActive,
        order: Number(form.order),
      };

      if (editing) {
        if (imageFile) {
          setImageUploading(true);
          try {
            const imageUrl = await uploadImage(editing.id, imageFile);
            data.imageUrl = imageUrl;
          } finally {
            setImageUploading(false);
          }
        }

        await request('PUT', `/api/admin/academy/courses/${editing.id}`, data);
        showToast('Curso actualizado');
      } else {
        const res = await request('POST', '/api/admin/academy/courses', data);
        if (res.success && imageFile) {
          setImageUploading(true);
          try {
            await uploadImage(res.data.id, imageFile);
          } finally {
            setImageUploading(false);
          }
        }
        showToast('Curso creado');
      }

      setShowForm(false);
      load();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string) {
    setConfirmDeleteId(id);
  }

  async function confirmDeleteCourse() {
    if (!confirmDeleteId) return;

    try {
      await request('DELETE', `/api/admin/academy/courses/${confirmDeleteId}`);
      showToast('Curso eliminado');
      load();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setConfirmDeleteId(null);
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Formato no valido (jpg, png, webp)', 'error');
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
    setForm((current) => ({ ...current, imageUrl: '' }));
  }

  return (
    <div className="space-y-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
            Academia
          </h1>
          <p className="text-sm text-stone-400">Gestion de cursos y contenido</p>
        </div>
        <button
          onClick={openCreate}
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-wine px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-wine-light"
        >
          <Plus size={16} /> Nuevo curso
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-wine" size={24} />
        </div>
      ) : courses.length === 0 ? (
        <div className="py-12 text-center text-sm text-stone-400">
          No hay cursos creados. Crea tu primer curso para comenzar.
        </div>
      ) : (
        <div className="grid gap-4">
          {courses.map((course) => (
            <div
              key={course.id}
              className="flex items-center justify-between rounded-lg border border-stone-200 bg-white p-5 transition-shadow hover:shadow-sm"
            >
              <div className="flex min-w-0 items-center gap-4">
                {course.imageUrl ? (
                  <img src={course.imageUrl} alt="" className="h-16 w-16 rounded-lg bg-stone-50 object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-wine/5">
                    <GraduationCap className="text-wine/40" size={24} />
                  </div>
                )}

                <div className="min-w-0">
                  <h3 className="truncate text-[15px] text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
                    {course.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-stone-400">
                    <span className="flex items-center gap-1">
                      <BookOpen size={12} /> {course._count.modules} modulos
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {course._count.accesses} accesos
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        course.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {course.isActive ? 'Visible' : 'Oculto'}
                    </span>
                    <span className="rounded-full bg-wine/10 px-2 py-0.5 font-medium text-wine">
                      {ACCESS_LABELS[course.baseTier] || ACCESS_LABELS.por_mayor}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(course)}
                  className="cursor-pointer p-2 text-stone-400 transition-colors hover:text-wine"
                  title="Editar informacion"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => router.push(`/admin/academia/${course.id}`)}
                  className="cursor-pointer p-2 text-stone-400 transition-colors hover:text-wine"
                  title="Gestionar contenido"
                >
                  <LayoutDashboard size={16} />
                </button>
                <button
                  onClick={() => handleDelete(course.id)}
                  className="cursor-pointer p-2 text-stone-400 transition-colors hover:text-red-500"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
              {editing ? 'Editar curso' : 'Nuevo curso'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-500">Titulo</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-stone-500">Slug</label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  required
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-stone-500">Descripcion</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-stone-500">Imagen del curso</label>
                {imagePreview || form.imageUrl ? (
                  <div className="group relative aspect-video w-full overflow-hidden rounded-lg bg-stone-100">
                    <img src={imagePreview || form.imageUrl} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X size={14} />
                    </button>
                    {imageFile && (
                      <span className="absolute bottom-2 left-2 rounded bg-amber-500/80 px-2 py-0.5 text-[10px] text-white">
                        Nueva imagen
                      </span>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer rounded-lg border-2 border-dashed border-stone-200 p-6 text-center transition-colors hover:border-stone-300"
                  >
                    <div className="flex flex-col items-center gap-2 text-stone-400">
                      <Upload size={20} />
                      <p className="text-sm">Arrastra una imagen o haz click</p>
                      <p className="text-[10px] text-stone-300">JPG, PNG o WebP - Max 5MB</p>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">Acceso del curso</label>
                  <select
                    value={form.baseTier}
                    onChange={(e) => setForm({ ...form, baseTier: e.target.value })}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20"
                  >
                    <option value="por_mayor">Por Mayor y Gran Mayor</option>
                    <option value="gran_mayor">Solo Gran Mayor</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">Visible en Academia</label>
                  <select
                    value={form.isActive ? 'visible' : 'oculto'}
                    onChange={(e) => setForm({ ...form, isActive: e.target.value === 'visible' })}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20"
                  >
                    <option value="visible">Visible</option>
                    <option value="oculto">Oculto</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">Orden</label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: e.target.value })}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wine/20"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving || imageUploading}
                  className="flex-1 cursor-pointer rounded-lg bg-wine py-2 text-sm font-medium text-white transition-colors hover:bg-wine-light disabled:opacity-50"
                >
                  {saving || imageUploading ? (
                    <Loader2 className="mx-auto animate-spin" size={16} />
                  ) : editing ? (
                    'Guardar cambios'
                  ) : (
                    'Crear curso'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
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
        open={!!confirmDeleteId}
        title="Eliminar curso"
        message="Eliminar este curso y todo su contenido? Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        onConfirm={confirmDeleteCourse}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
