import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-wine text-champagne/70">
      <div className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="grid sm:grid-cols-4 gap-10 sm:gap-8">
          <div className="sm:col-span-1">
            <p className="font-logo text-3xl text-champagne/90 mb-3">D&apos;orella</p>
            <p className="text-xs leading-relaxed text-champagne/40 font-light tracking-wide">
              Joyería en oro laminado 18k con 30 micras de grosor. Calidad, brillo y durabilidad garantizados.
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-champagne/30 font-semibold mb-4">Navegación</p>
            <div className="space-y-2.5">
              {[
                { href: '/', label: 'Inicio' },
                { href: '/catalogo', label: 'Catálogo' },
                { href: '/mis-pedidos', label: 'Mis pedidos' },
                { href: '/mis-catalogos', label: 'Para revendedores' },
              ].map((l) => (
                <Link key={l.href} href={l.href} className="block text-[13px] text-champagne/50 hover:text-champagne transition-colors cursor-pointer font-light tracking-wide">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-champagne/30 font-semibold mb-4">Contacto</p>
            <div className="space-y-2.5 text-sm text-champagne/50 font-light">
              <p>WhatsApp: +57 300 000 0000</p>
              <p>ventas@dorella.co</p>
              <p>Medellín, Colombia</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-champagne/30 font-semibold mb-4">Información</p>
            <div className="space-y-2.5 text-sm text-champagne/50 font-light">
              <p>Garantía de tonalidad</p>
              <p>Envíos a todo Colombia</p>
              <p>Pedido mínimo: $500.000</p>
            </div>
          </div>
        </div>
        <div className="separator mt-12 mb-6 opacity-20" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[9px] text-champagne/25 tracking-[0.2em] uppercase">
            &copy; {new Date().getFullYear()} D&apos;orella — Todos los derechos reservados
          </p>
        </div>
      </div>
    </footer>
  );
}
