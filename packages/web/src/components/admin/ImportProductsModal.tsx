'use client';

import { useState, useRef } from 'react';
import {
  X, Upload, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet,
} from 'lucide-react';
import { useToast } from '@/context/ToastProvider';

interface ImportRowChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

interface ImportRowError {
  field: string;
  value: string;
  message: string;
}

interface ImportRowResult {
  row: number;
  sku: string;
  nombre: string;
  status: 'nuevo' | 'actualizar' | 'sin_cambios' | 'error';
  changes: ImportRowChange[];
  errors: ImportRowError[];
}

interface ImportPreview {
  totalRows: number;
  nuevos: number;
  actualizados: number;
  sinCambios: number;
  conErrores: number;
  rows: ImportRowResult[];
}

interface ImportResult {
  creados: number;
  actualizados: number;
  sinCambios: number;
}

type Step = 'select' | 'analyzing' | 'preview' | 'confirming' | 'result' | 'error';

const STATUS_BADGE: Record<ImportRowResult['status'], { label: string; className: string }> = {
  nuevo: { label: 'Nuevo', className: 'bg-emerald-50 text-emerald-700' },
  actualizar: { label: 'Actualizar', className: 'bg-blue-50 text-blue-700' },
  sin_cambios: { label: 'Sin cambios', className: 'bg-stone-100 text-stone-500' },
  error: { label: 'Error', className: 'bg-red-50 text-red-700' },
};

async function readJsonOrThrow(res: Response) {
  const data = await res.json();
  if (!data.success) throw new Error(data.error?.message || 'Error procesando el archivo');
  return data.data;
}

export default function ImportProductsModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep('select');
    setFile(null);
    setPreview(null);
    setResult(null);
    setErrorMessage('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function analyzeFile(selected: File) {
    setFile(selected);
    setStep('analyzing');

    try {
      const formData = new FormData();
      formData.append('file', selected);
      const res = await fetch('/api/admin/products/import/preview', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await readJsonOrThrow(res);
      setPreview(data as ImportPreview);
      setStep('preview');
    } catch (e) {
      setErrorMessage((e as Error).message);
      setStep('error');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) analyzeFile(selected);
    e.target.value = '';
  }

  async function confirmImport() {
    if (!file) return;
    setStep('confirming');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/products/import/confirm', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await readJsonOrThrow(res);
      setResult(data as ImportResult);
      setStep('result');
      onImported();
    } catch (e) {
      setErrorMessage((e as Error).message);
      setStep('error');
    }
  }

  if (!open) return null;

  const hasBlockingErrors = (preview?.conErrores ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
            Importar productos desde Excel
          </h3>
          <button onClick={handleClose} className="cursor-pointer text-stone-400 hover:text-stone-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'select' && (
            <div
              onClick={() => inputRef.current?.click()}
              className="cursor-pointer rounded-lg border-2 border-dashed border-stone-200 p-10 text-center transition-colors hover:border-wine/30"
            >
              <FileSpreadsheet size={32} className="mx-auto mb-3 text-stone-300" />
              <p className="text-sm text-stone-600">Hacé clic para seleccionar un archivo .xlsx o .csv</p>
              <p className="mt-1 text-xs text-stone-400">Identificamos los productos por SKU.</p>
              <a
                href="/api/admin/products/import/template"
                download
                onClick={(e) => e.stopPropagation()}
                className="mt-3 inline-block text-xs font-medium text-wine hover:text-wine-light"
              >
                Descargar plantilla
              </a>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 size={32} className="animate-spin text-wine" />
              <p className="text-sm text-stone-500">Analizando archivo...</p>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <AlertTriangle size={32} className="text-red-500" />
              <p className="text-sm text-stone-700">{errorMessage}</p>
              <button
                onClick={reset}
                className="mt-2 rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
              >
                Intentar de nuevo
              </button>
            </div>
          )}

          {step === 'preview' && preview && (
            <div>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-emerald-50 p-3 text-center">
                  <p className="text-xl font-semibold text-emerald-700">{preview.nuevos}</p>
                  <p className="text-[10px] uppercase tracking-wider text-emerald-600">Nuevos</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3 text-center">
                  <p className="text-xl font-semibold text-blue-700">{preview.actualizados}</p>
                  <p className="text-[10px] uppercase tracking-wider text-blue-600">Con cambios</p>
                </div>
                <div className="rounded-lg bg-stone-100 p-3 text-center">
                  <p className="text-xl font-semibold text-stone-600">{preview.sinCambios}</p>
                  <p className="text-[10px] uppercase tracking-wider text-stone-500">Sin cambios</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3 text-center">
                  <p className="text-xl font-semibold text-red-700">{preview.conErrores}</p>
                  <p className="text-[10px] uppercase tracking-wider text-red-600">Con errores</p>
                </div>
              </div>

              {hasBlockingErrors && (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  Corregí las filas con error en el Excel y volvé a subirlo — no se puede confirmar mientras haya errores.
                </p>
              )}

              <div className="overflow-x-auto rounded-lg border border-stone-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-stone-100 text-[10px] uppercase tracking-wider text-stone-400">
                      <th className="px-3 py-2 text-left font-medium">Fila</th>
                      <th className="px-3 py-2 text-left font-medium">SKU</th>
                      <th className="px-3 py-2 text-left font-medium">Producto</th>
                      <th className="px-3 py-2 text-left font-medium">Resultado</th>
                      <th className="px-3 py-2 text-left font-medium">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.row} className="border-b border-stone-50">
                        <td className="px-3 py-2 text-stone-400">{r.row}</td>
                        <td className="px-3 py-2 font-mono text-stone-600">{r.sku || '—'}</td>
                        <td className="px-3 py-2 text-stone-600">{r.nombre || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[r.status].className}`}>
                            {STATUS_BADGE[r.status].label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-stone-500">
                          {r.status === 'actualizar' && r.changes.map((c) => (
                            <div key={c.field}>{c.label}: {c.from} → {c.to}</div>
                          ))}
                          {r.status === 'error' && r.errors.map((e) => (
                            <div key={e.field} className="text-red-600">{e.message}</div>
                          ))}
                          {(r.status === 'nuevo' || r.status === 'sin_cambios') && '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'confirming' && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 size={32} className="animate-spin text-wine" />
              <p className="text-sm text-stone-500">Aplicando cambios...</p>
            </div>
          )}

          {step === 'result' && result && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <CheckCircle2 size={40} className="text-emerald-500" />
              <p className="text-base font-medium text-stone-700">Importación completada</p>
              <p className="text-sm text-stone-500">
                {result.creados} creados · {result.actualizados} actualizados · {result.sinCambios} sin cambios
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-stone-100 px-6 py-4">
          {step === 'preview' && (
            <>
              <button
                onClick={reset}
                className="cursor-pointer rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50"
              >
                Elegir otro archivo
              </button>
              <button
                onClick={confirmImport}
                disabled={hasBlockingErrors}
                className="flex cursor-pointer items-center gap-2 rounded-lg bg-wine px-5 py-2.5 text-sm font-semibold text-white hover:bg-wine-light disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Upload size={14} />
                Confirmar importación
              </button>
            </>
          )}
          {step === 'result' && (
            <button
              onClick={handleClose}
              className="cursor-pointer rounded-lg bg-wine px-5 py-2.5 text-sm font-semibold text-white hover:bg-wine-light"
            >
              Cerrar
            </button>
          )}
          {(step === 'select' || step === 'analyzing' || step === 'confirming' || step === 'error') && (
            <button
              onClick={handleClose}
              className="cursor-pointer rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
