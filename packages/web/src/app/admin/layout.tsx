'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/context/ToastProvider';
import Toast from '@/components/ui/Toast';
import { adminHome, canAccessAdminPath, isStaffRole } from '@/lib/admin-access';
import { isNavItemActive, navGroupsForRole } from '@/lib/admin-nav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!isStaffRole(user.role)) {
      showToast('No tenés permisos de administrador', 'error');
      router.replace('/catalogo');
      return;
    }
    if (!canAccessAdminPath(user.role, pathname)) {
      router.replace(adminHome(user.role));
      return;
    }
    setAllowed(true);
  }, [user, router, showToast, pathname]);

  // El cajón móvil se cierra con Escape y no deja desplazar el fondo.
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [sidebarOpen]);

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  if (!user || !allowed) return null;

  const groups = navGroupsForRole(user.role);

  const sidebar = (
    <div className="flex h-full flex-col overflow-y-auto bg-jeweler text-ivory">
      <div className="flex items-start justify-between border-b border-white/10 px-6 pb-5 pt-7">
        <div>
          <p className="text-3xl text-gold" style={{ fontFamily: 'var(--font-script)' }}>
            D&apos;orella
          </p>
          <p className="mt-1 font-sans text-xs uppercase tracking-[0.2em] text-stone-400">
            {user.role === 'comercial' ? 'Panel Comercial' : user.role === 'bodega' ? 'Panel Bodega' : 'Panel Admin'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar menú"
          className="cursor-pointer rounded-lg p-2 text-stone-300 transition-colors hover:bg-white/10 hover:text-ivory lg:hidden"
        >
          <X size={18} />
        </button>
      </div>

      <nav aria-label="Panel de administración" className="flex-1 space-y-5 px-3 py-5">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-4 pb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">{group.title}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ href, icon: Icon, label }) => {
                const isActive = isNavItemActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setSidebarOpen(false)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`relative flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-gold/15 font-semibold text-gold before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:bg-gold'
                          : 'text-stone-300 hover:bg-white/5 hover:text-ivory'
                      }`}
                    >
                      <Icon size={18} aria-hidden />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-white/10 px-3 py-4">
        <Link
          href="/catalogo"
          onClick={() => setSidebarOpen(false)}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-stone-300 transition-colors hover:bg-white/5 hover:text-ivory"
        >
          <ArrowLeft size={18} aria-hidden />
          Volver a la tienda
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-stone-300 transition-colors hover:bg-white/5 hover:text-red-300"
        >
          <LogOut size={18} aria-hidden />
          Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-ivory">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-white/5 lg:block">{sidebar}</aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú del panel">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative h-full w-[280px] max-w-[85vw] shadow-2xl">{sidebar}</div>
        </div>
      )}

      <main className="min-w-0 flex-1 lg:ml-[260px]">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={sidebarOpen}
            className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-stone-100"
          >
            <Menu size={20} className="text-stone-600" />
          </button>
          <span className="text-xl text-gold" style={{ fontFamily: 'var(--font-script)' }}>
            D&apos;orella
          </span>
          <span className="text-xs uppercase tracking-widest text-stone-500">Admin</span>
        </div>

        <div className="mx-auto min-w-0 max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {/* Las pantallas leen el periodo de la URL (useSearchParams). */}
          <Suspense fallback={null}>{children}</Suspense>
        </div>
      </main>

      <Toast />
    </div>
  );
}
