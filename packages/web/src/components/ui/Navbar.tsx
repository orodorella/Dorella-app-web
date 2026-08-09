'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShoppingBag, LogIn, LogOut, Menu, X } from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthProvider';
import { useCart } from '@/context/CartProvider';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { href: '/', label: 'Inicio' },
    { href: '/catalogo', label: 'Catálogo' },
    { href: '/academia', label: 'Academia' },
    ...(user
      ? [
          { href: '/mis-pedidos', label: 'Mis Pedidos' },
          { href: '/mis-catalogos', label: 'Mis Catálogos' },
          ...(user.role === 'admin' ? [{ href: '/admin', label: 'Admin' }] : []),
        ]
      : []),
  ];

  const isActive = (href: string) => pathname === href;

  async function handleLogout() {
    await logout();
    setMobileOpen(false);
    router.push('/login');
  }

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-6">
          <Link href="/" className="cursor-pointer" onClick={() => setMobileOpen(false)}>
            <span className="font-logo text-[2rem] leading-none text-wine sm:text-[2.5rem]">D&apos;orella</span>
          </Link>

          <div className="hidden items-center gap-9 lg:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative cursor-pointer pb-1 text-[11px] font-medium uppercase tracking-[0.18em] transition-colors duration-300 ${
                  isActive(link.href) ? 'text-wine' : 'text-stone-400 hover:text-stone-700'
                }`}
              >
                {link.label}
                {isActive(link.href) && (
                  <m.div
                    layoutId="nav-underline"
                    className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-wine"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {!user && (
              <Link
                href="/login"
                className="hidden items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500 transition-colors hover:text-wine sm:flex"
              >
                <LogIn size={16} />
                Iniciar sesión
              </Link>
            )}

            <Link
              href="/carrito"
              className="relative cursor-pointer p-2 text-stone-400 transition-colors hover:text-wine"
              aria-label={totalItems > 0 ? `Carrito, ${totalItems} producto(s)` : 'Carrito'}
            >
              <ShoppingBag size={20} />
              {totalItems > 0 && (
                <m.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-wine text-[9px] font-bold text-white"
                >
                  {totalItems > 99 ? '99+' : totalItems}
                </m.span>
              )}
            </Link>

            {user && (
              <>
                <Link
                  href="/mi-perfil"
                  className="group hidden cursor-pointer items-center gap-3 xl:flex"
                  onClick={() => setMobileOpen(false)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-wine transition-colors group-hover:bg-wine-light">
                    <span className="text-[11px] font-medium text-white" style={{ fontFamily: 'var(--font-serif)' }}>
                      {user.nombre?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium leading-tight text-stone-600 transition-colors group-hover:text-wine">
                      {user.nombre}
                    </p>
                    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-wine">
                      {user.label || user.tier}
                    </span>
                  </div>
                </Link>

                <button
                  onClick={handleLogout}
                  className="hidden cursor-pointer p-2 text-stone-300 transition-colors hover:text-stone-500 sm:block"
                  aria-label="Cerrar sesión"
                >
                  <LogOut size={16} />
                </button>
              </>
            )}

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="cursor-pointer p-2 text-stone-500 hover:text-stone-700 lg:hidden"
              aria-label="Menú"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <m.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-[72px] z-30 border-b border-stone-200 bg-white shadow-lg lg:hidden"
          >
            <div className="mx-auto max-w-[1200px] space-y-1 px-6 py-4">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block cursor-pointer py-3 text-[12px] font-medium uppercase tracking-[0.14em] transition-colors ${
                    isActive(link.href) ? 'text-wine' : 'text-stone-500'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {user && (
                <>
                  <Link
                    href="/mi-perfil"
                    onClick={() => setMobileOpen(false)}
                    className="block cursor-pointer py-3 text-[12px] font-medium uppercase tracking-[0.14em] text-stone-500"
                  >
                    Mi Perfil
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full cursor-pointer py-3 text-left text-[12px] font-medium uppercase tracking-[0.14em] text-stone-400"
                  >
                    Cerrar sesión
                  </button>
                </>
              )}

              {!user && (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex cursor-pointer items-center gap-2 py-3 text-[12px] font-medium uppercase tracking-[0.14em] text-stone-500"
                >
                  <LogIn size={16} />
                  Iniciar sesión
                </Link>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
