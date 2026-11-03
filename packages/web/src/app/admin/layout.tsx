'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Users, Package, Tag, ShoppingBag, GraduationCap, ArrowLeft, LogOut, Menu, LineChart, Percent, Coins, TrendingUp, Receipt, Landmark, Boxes } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/context/ToastProvider';
import Toast from '@/components/ui/Toast';
import { adminHome, canAccessAdminPath, isStaffRole } from '@/lib/admin-access';

const NAV_ITEMS = [
  { href: '/admin', icon: BarChart3, label: 'Dashboard' },
  { href: '/admin/finanzas', icon: Landmark, label: 'Resumen financiero' },
  { href: '/admin/usuarios', icon: Users, label: 'Usuarios' },
  { href: '/admin/productos', icon: Package, label: 'Productos' },
  { href: '/admin/categorias', icon: Tag, label: 'Categorías' },
  { href: '/admin/ordenes', icon: ShoppingBag, label: 'Órdenes' },
  { href: '/admin/rendimiento', icon: LineChart, label: 'Rendimiento comercial' },
  { href: '/admin/comisiones', icon: Percent, label: 'Comisiones' },
  { href: '/admin/costos', icon: Coins, label: 'Costos' },
  { href: '/admin/inventario-costos', icon: Boxes, label: 'Compras e inventario' },
  { href: '/admin/rentabilidad', icon: TrendingUp, label: 'Rentabilidad' },
  { href: '/admin/gastos', icon: Receipt, label: 'Gastos' },
  { href: '/admin/academia', icon: GraduationCap, label: 'Academia' },
];

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

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  if (!user || !allowed) return null;

  const sidebar = (
    <div className="flex h-full flex-col overflow-y-auto bg-jeweler text-ivory">
      <div className="border-b border-white/10 px-6 pb-6 pt-8">
        <h1 className="text-3xl text-gold" style={{ fontFamily: 'var(--font-script)' }}>
          D&apos;orella
        </h1>
        <p className="mt-1 font-sans text-[10px] uppercase tracking-[0.2em] text-stone-500">
          {user.role === 'comercial' ? 'Panel Comercial' : user.role === 'bodega' ? 'Panel Bodega' : 'Panel Admin'}
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.filter(({ href }) => canAccessAdminPath(user.role, href)).map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors ${
                isActive ? 'bg-gold/15 font-medium text-gold' : 'text-stone-400 hover:bg-white/5 hover:text-ivory'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 px-3 pb-6">
        <Link
          href="/catalogo"
          onClick={() => setSidebarOpen(false)}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-stone-400 transition-colors hover:bg-white/5 hover:text-ivory"
        >
          <ArrowLeft size={18} />
          Volver a la tienda
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-sm text-stone-400 transition-colors hover:bg-white/5 hover:text-red-400"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-ivory">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-white/5 lg:block">{sidebar}</aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative h-full w-[272px] max-w-[82vw] shadow-2xl">{sidebar}</div>
        </div>
      )}

      <main className="min-w-0 flex-1 lg:ml-[260px]">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-stone-100"
          >
            <Menu size={20} className="text-stone-600" />
          </button>
          <span className="text-xl text-gold" style={{ fontFamily: 'var(--font-script)' }}>
            D&apos;orella
          </span>
          <span className="text-[9px] uppercase tracking-widest text-stone-400">Admin</span>
        </div>

        <div className="mx-auto min-w-0 max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>

      <Toast />
    </div>
  );
}
