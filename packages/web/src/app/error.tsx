'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <h2 className="text-2xl text-stone-800 mb-3" style={{ fontFamily: 'var(--font-serif)' }}>Algo salió mal</h2>
        <p className="text-sm text-stone-400 font-light mb-8">Ocurrió un error inesperado. Intentá de nuevo.</p>
        <button onClick={() => reset()}
          className="inline-flex items-center gap-2 bg-wine text-white px-8 py-3 rounded-lg text-sm font-semibold uppercase tracking-wider hover:bg-wine-light transition-colors cursor-pointer">
          Reintentar
        </button>
      </div>
    </div>
  );
}
