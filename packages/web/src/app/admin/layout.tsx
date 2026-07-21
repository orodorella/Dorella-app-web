'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Users, Package, ShoppingBag, ArrowLeft, LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/context/ToastProvider';
import Toast from '@/components/ui/Toast';

const NAV_ITEMS = [
  { href: '/admin', icon: BarChart3, label: 'Dashboard' },
  { href: '/admin/usuarios', icon: Users, label: 'Usuarios' },
  { href: '/admin/productos', icon: Package, label: 'Productos' },
  { href: '/admin/ordenes', icon: ShoppingBag, label: 'Órdenes' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'admin') { showToast('No tenés permisos de administrador', 'error'); router.replace('/catalogo'); return; }
    setAllowed(true);
  }, [user, router, showToast]);

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  if (!user || !allowed) return null;

  const sidebar = (
    <div className="flex flex-col h-full bg-jeweler text-ivory">
      <div className="px-6 pt-8 pb-6 border-b border-white/10">
        <h1 className="text-3xl text-gold" style={{ fontFamily: 'var(--font-script)' }}>D&apos;orella</h1>
        <p className="text-[10px] text-stone-500 uppercase tracking-[0.2em] mt-1 font-sans">Panel Admin</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${isActive ? 'bg-gold/15 text-gold font-medium' : 'text-stone-400 hover:text-ivory hover:bg-white/5'}`}>
              <Icon size={18} />{label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 pb-6 space-y-1">
        <Link href="/catalogo" onClick={() => setSidebarOpen(false)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-stone-400 hover:text-ivory hover:bg-white/5 transition-colors">
          <ArrowLeft size={18} />Volver a la tienda
        </Link>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-stone-400 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer">
          <LogOut size={18} />Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ivory flex">
      <aside className="hidden lg:block w-[240px] fixed inset-y-0 left-0 z-30">{sidebar}</aside>
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-[240px] h-full">{sidebar}</div>
        </div>
      )}
      <main className="flex-1 lg:ml-[240px] min-h-screen">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-stone-200">
          <button onClick={() => setSidebarOpen(true)} className="p-2 cursor-pointer"><Menu size={20} className="text-stone-600" /></button>
          <span className="text-gold text-xl" style={{ fontFamily: 'var(--font-script)' }}>D&apos;orella</span>
          <span className="text-[9px] text-stone-400 uppercase tracking-widest">Admin</span>
        </div>
        <div className="p-6 lg:p-8">{children}</div>
      </main>
      <Toast />
    </div>
  );
}
