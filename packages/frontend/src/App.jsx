import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import TopBar from './components/TopBar'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Toast from './components/Toast'
import FacilitadorSwitch from './components/FacilitadorSwitch'
import Login from './pages/Login'
import Registro from './pages/Registro'
import AuthCallback from './pages/AuthCallback'
import Home from './pages/Home'
import Catalogo from './pages/Catalogo'
import Producto from './pages/Producto'
import Carrito from './pages/Carrito'
import Checkout from './pages/Checkout'
import Confirmacion from './pages/Confirmacion'
import MisPedidos from './pages/MisPedidos'
import CatalogoSinMarca from './pages/CatalogoSinMarca'
import MiPerfil from './pages/MiPerfil'
import MisCatalogos from './pages/MisCatalogos'
import CatalogoPublico from './pages/CatalogoPublico'
import AdminLayout from './layouts/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsuarios from './pages/admin/AdminUsuarios'
import AdminProductos from './pages/admin/AdminProductos'
import AdminOrdenes from './pages/admin/AdminOrdenes'

function ProtectedRoute({ children }) {
  const { user } = useApp()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  const { user, showToast } = useApp()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') {
    showToast('No tenés permisos de administrador', 'error')
    return <Navigate to="/catalogo" replace />
  }
  return <AdminLayout>{children}</AdminLayout>
}

function AppRoutes() {
  const { user } = useApp()

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/c/:slug" element={<CatalogoPublico />} />
        <Route path="/admin" element={<AdminRoute><Navigate to="/admin/dashboard" replace /></AdminRoute>} />
        <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/usuarios" element={<AdminRoute><AdminUsuarios /></AdminRoute>} />
        <Route path="/admin/productos" element={<AdminRoute><AdminProductos /></AdminRoute>} />
        <Route path="/admin/ordenes" element={<AdminRoute><AdminOrdenes /></AdminRoute>} />
        <Route path="/*" element={
          <div className="min-h-screen flex flex-col bg-white">
            <TopBar />
            <Navbar />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/catalogo" element={
                <ProtectedRoute><Catalogo /></ProtectedRoute>
              } />
              <Route path="/producto/:id" element={
                <ProtectedRoute><Producto /></ProtectedRoute>
              } />
              <Route path="/carrito" element={
                <ProtectedRoute><Carrito /></ProtectedRoute>
              } />
              <Route path="/checkout" element={
                <ProtectedRoute><Checkout /></ProtectedRoute>
              } />
              <Route path="/confirmacion" element={
                <ProtectedRoute><Confirmacion /></ProtectedRoute>
              } />
              <Route path="/mis-pedidos" element={
                <ProtectedRoute><MisPedidos /></ProtectedRoute>
              } />
              <Route path="/mi-perfil" element={
                <ProtectedRoute><MiPerfil /></ProtectedRoute>
              } />
              <Route path="/catalogo-sin-marca" element={
                <ProtectedRoute><CatalogoSinMarca /></ProtectedRoute>
              } />
              <Route path="/mis-catalogos" element={
                <ProtectedRoute><MisCatalogos /></ProtectedRoute>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Footer />
            {user && <FacilitadorSwitch />}
          </div>
        } />
      </Routes>
      <Toast />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  )
}
