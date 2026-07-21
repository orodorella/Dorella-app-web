'use client';

import { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import Image from 'next/image';
import { Upload, X, Loader2 } from 'lucide-react';

export interface ImageUploaderHandle {
  uploadPendingFiles: (productId: string) => Promise<string[]>;
}

interface Props {
  productId?: string;
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

interface PendingFile { file: File; preview: string; }

const ImageUploader = forwardRef<ImageUploaderHandle, Props>(function ImageUploader(
  { productId, images, onImagesChange, maxImages = 5 },
  ref,
) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const remaining = maxImages - images.length - pendingFiles.length;

  async function uploadToServer(files: File[], targetId: string): Promise<string[]> {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));

    const res = await fetch(`/api/admin/products/${targetId}/images`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!res.ok) throw new Error('Error subiendo imágenes');
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Error subiendo imágenes');
    return data.data as string[];
  }

  async function removeServerImage(productId: string, index: number): Promise<string[]> {
    const res = await fetch(`/api/admin/products/${productId}/images/${index}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error eliminando imagen');
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Error eliminando imagen');
    return data.data as string[];
  }

  useImperativeHandle(ref, () => ({
    async uploadPendingFiles(targetId: string): Promise<string[]> {
      if (pendingFiles.length === 0) return images;
      setUploading(true);
      try {
        const uploadedUrls = await uploadToServer(pendingFiles.map((pf) => pf.file), targetId);
        pendingFiles.forEach((pf) => URL.revokeObjectURL(pf.preview));
        setPendingFiles([]);
        onImagesChange(uploadedUrls);
        return uploadedUrls;
      } finally {
        setUploading(false);
      }
    },
  }));

  function addFiles(files: FileList) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const valid = Array.from(files).filter((f) => allowed.includes(f.type) && f.size <= 5 * 1024 * 1024);
    if (valid.length === 0) return;

    const toAdd = valid.slice(0, remaining);
    if (toAdd.length === 0) return;

    if (productId) {
      uploadServerFiles(toAdd);
    } else {
      const newPending = toAdd.map((f) => ({ file: f, preview: URL.createObjectURL(f) }));
      setPendingFiles((prev) => [...prev, ...newPending]);
    }
  }

  async function uploadServerFiles(files: File[]) {
    setUploading(true);
    try {
      const updatedUrls = await uploadToServer(files, productId!);
      onImagesChange(updatedUrls);
    } catch {
    } finally {
      setUploading(false);
    }
  }

  async function removeImage(index: number) {
    if (!productId) {
      onImagesChange(images.filter((_, i) => i !== index));
      return;
    }

    try {
      const updatedUrls = await removeServerImage(productId, index);
      onImagesChange(updatedUrls);
    } catch {
    }
  }

  function removePending(index: number) {
    setPendingFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  }

  const allPreviews = [...images, ...pendingFiles.map((pf) => pf.preview)];

  return (
    <div>
      <label className="block text-[10px] font-medium text-stone-500 uppercase tracking-[0.15em] mb-2">
        Imágenes ({images.length + pendingFiles.length}/{maxImages})
      </label>

      {allPreviews.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-3">
          {images.map((url, i) => (
            <div key={`saved-${i}`} className="relative aspect-square rounded-lg overflow-hidden bg-stone-100 group">
              <Image src={url} alt={`Imagen ${i + 1}`} fill sizes="80px" className="object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {pendingFiles.map((pf, i) => (
            <div key={`pending-${i}`} className="relative aspect-square rounded-lg overflow-hidden bg-stone-100 group">
              <Image src={pf.preview} alt={`Pendiente ${i + 1}`} fill sizes="80px" className="object-cover" />
              <span className="absolute bottom-0 left-0 right-0 bg-amber-500/80 text-white text-[8px] text-center py-0.5">Pendiente</span>
              <button
                type="button"
                onClick={() => removePending(i)}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {remaining > 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragOver ? 'border-wine bg-wine/[0.02]' : 'border-stone-200 hover:border-stone-300'}`}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-stone-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Subiendo...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-stone-400">
              <Upload size={20} />
              <p className="text-sm">Arrastra imágenes aquí o haz click para seleccionar</p>
              <p className="text-[10px] text-stone-300">JPG, PNG o WebP — Máx 5MB c/u</p>
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
});

export default ImageUploader;
