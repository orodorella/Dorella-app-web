import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-wine text-champagne/70">
      <div className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="grid sm:grid-cols-4 gap-10 sm:gap-8">
          <div className="sm:col-span-1">
            <p className="font-logo text-3xl text-champagne/90 mb-3">D&apos;orella</p>
            <p className="text-xs leading-relaxed text-champagne/70 font-light tracking-wide">
              Joyería en oro laminado 18k con 30 micras de grosor. Calidad, brillo y durabilidad garantizados.
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-champagne/65 font-semibold mb-4">Navegación</p>
            <div className="space-y-2.5">
              {[
                { href: '/', label: 'Inicio' },
                { href: '/catalogo', label: 'Catálogo' },
                { href: '/mis-pedidos', label: 'Mis pedidos' },
              ].map((l) => (
                <Link key={l.href} href={l.href} className="block text-[13px] text-champagne/75 hover:text-champagne transition-colors cursor-pointer font-light tracking-wide">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-champagne/65 font-semibold mb-4">Contacto</p>
            <div className="space-y-2.5 text-sm text-champagne/75 font-light">
              <a
                href="https://wa.me/573156343383"
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-champagne transition-colors"
              >
                WhatsApp: +57 315 634 3383
              </a>
              <p>dorellajewels@gmail.com</p>
              <p>Cali, Colombia</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-champagne/65 font-semibold mb-4">Información</p>
            <div className="space-y-2.5 text-sm text-champagne/75 font-light">
              <Link href="/#preguntas-frecuentes" className="block hover:text-champagne transition-colors">
                Preguntas frecuentes
              </Link>
              <p>Envíos a todo Colombia</p>
              <p>Pedido mínimo: $500.000</p>
            </div>
          </div>
        </div>
        <div className="separator mt-12 mb-6 opacity-20" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[9px] text-champagne/65 tracking-[0.2em] uppercase">
            &copy; {new Date().getFullYear()} D&apos;orella - Todos los derechos reservados
          </p>
        </div>
      </div>
    </footer>
  );
}
