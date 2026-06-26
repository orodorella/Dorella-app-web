import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <h1 className="text-8xl text-wine/20 font-bold mb-4" style={{ fontFamily: 'var(--font-serif)' }}>404</h1>
        <h2 className="text-2xl text-stone-800 mb-3" style={{ fontFamily: 'var(--font-serif)' }}>Página no encontrada</h2>
        <p className="text-sm text-stone-400 font-light mb-8">La página que buscás no existe o fue movida.</p>
        <Link href="/" className="inline-flex items-center gap-2 bg-wine text-white px-8 py-3 rounded-lg text-sm font-semibold uppercase tracking-wider hover:bg-wine-light transition-colors">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
