import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShoppingBag, LogOut, User, Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'

export default function Navbar() {
  const { user, totalItems, dispatch } = useApp()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const links = [
    { path: '/', label: 'Inicio' },
    { path: '/catalogo', label: 'Catálogo' },
    ...(user ? [
      { path: '/mis-pedidos', label: 'Mis Pedidos' },
      { path: '/mis-catalogos', label: 'Mis Catálogos' },
      { path: '/carrito', label: 'Carrito' },
      ...(user.role === 'admin' ? [{ path: '/admin', label: 'Admin' }] : []),
    ] : []),
  ]

  const isActive = (path) => location.pathname === path

  return (
    <>
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-between h-[72px]">
          <Link to="/" className="cursor-pointer" onClick={() => setMobileOpen(false)}>
            <span className="font-logo text-[2rem] sm:text-[2.5rem] text-wine leading-none">
              D'orella
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-9">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`relative text-[11px] font-medium tracking-[0.18em] uppercase transition-colors duration-300 cursor-pointer pb-1 ${
                  isActive(link.path) ? 'text-wine' : 'text-stone-400 hover:text-stone-700'
                }`}
              >
                {link.label}
                {isActive(link.path) && (
                  <motion.div
                    layoutId="nav-underline"
                    className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-wine"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <>
                <Link to="/mi-perfil" className="hidden xl:flex items-center gap-3 cursor-pointer group" onClick={() => setMobileOpen(false)}>
                  <div className="w-8 h-8 rounded-full bg-wine flex items-center justify-center group-hover:bg-wine-light transition-colors">
                    <span className="text-white text-[11px] font-medium" style={{ fontFamily: 'var(--font-serif)' }}>
                      {user.nombre?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-stone-600 leading-tight font-medium group-hover:text-wine transition-colors">{user.nombre}</p>
                    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-wine">
                      {user.label || user.tier}
                    </span>
                  </div>
                </Link>
                <Link
                  to="/carrito"
                  className="relative p-2 text-stone-400 hover:text-wine transition-colors cursor-pointer"
                >
                  <ShoppingBag size={20} />
                  {totalItems > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-0.5 -right-0.5 bg-wine text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center"
                    >
                      {totalItems > 99 ? '99+' : totalItems}
                    </motion.span>
                  )}
                </Link>
                <button
                  onClick={() => dispatch({ type: 'LOGOUT' })}
                  className="hidden sm:block p-2 text-stone-300 hover:text-stone-500 transition-colors cursor-pointer"
                  aria-label="Cerrar sesión"
                >
                  <LogOut size={16} />
                </button>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 text-stone-500 hover:text-stone-700 cursor-pointer"
              aria-label="Menú"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-[72px] bg-white border-b border-stone-200 z-30 shadow-lg lg:hidden"
          >
            <div className="max-w-[1200px] mx-auto px-6 py-4 space-y-1">
              {links.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileOpen(false)}
                  className={`block py-3 text-[12px] tracking-[0.14em] uppercase transition-colors cursor-pointer font-medium ${
                    isActive(link.path) ? 'text-wine' : 'text-stone-500'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {user && (
                <Link
                  to="/mi-perfil"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 py-3 text-[12px] tracking-[0.14em] uppercase transition-colors cursor-pointer font-medium ${
                    isActive('/mi-perfil') ? 'text-wine' : 'text-stone-500'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-wine flex items-center justify-center">
                    <span className="text-white text-[9px] font-medium" style={{ fontFamily: 'var(--font-serif)' }}>
                      {user.nombre?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  Mi Perfil
                </Link>
              )}
              {user && (
                <button
                  onClick={() => { dispatch({ type: 'LOGOUT' }); setMobileOpen(false) }}
                  className="block w-full text-left py-3 text-[12px] tracking-[0.14em] uppercase text-stone-400 cursor-pointer font-medium"
                >
                  Cerrar sesión
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
