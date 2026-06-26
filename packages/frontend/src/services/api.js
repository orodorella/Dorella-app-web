const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

let accessToken = null
let logoutCallback = null

export function setAccessToken(token) { accessToken = token }
export function clearAccessToken() { accessToken = null }
export function onLogout(cb) { logoutCallback = cb }

export const TIER_MAP = {
  detal: 'detal',
  por_mayor: 'mayorista',
  gran_mayor: 'granmayorista',
}

export const TIER_MAP_REVERSE = {
  detal: 'detal',
  mayorista: 'por_mayor',
  granmayorista: 'gran_mayor',
}

function mapUserFromApi(apiUser) {
  const frontendTier = TIER_MAP[apiUser.tier] || 'detal'
  return {
    id: apiUser.id,
    nombre: `${apiUser.nombre} ${apiUser.apellido}`,
    email: apiUser.email,
    tier: frontendTier,
    label: { detal: 'Detal / Visitante', mayorista: 'Por Mayor', granmayorista: 'Gran Mayor' }[frontendTier],
    descuento: { detal: 0, mayorista: 0.375, granmayorista: 0.5 }[frontendTier],
    minimo: { detal: 0, mayorista: 500000, granmayorista: 5000000 }[frontendTier],
    direccion: apiUser.direccion || '',
    telefono: apiUser.telefono || '',
    ciudad: apiUser.ciudad || '',
    empresa: apiUser.empresa || '',
    role: apiUser.role,
    provider: apiUser.provider || 'email',
  }
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const opts = { method, headers, credentials: 'include' }
  if (body && method !== 'GET') {
    opts.body = JSON.stringify(body)
  }

  const res = await fetch(`${API_BASE}${path}`, opts)

  if (res.status === 401 && path !== '/api/auth/refresh') {
    const refreshed = await tryRefresh()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`
      const retry = await fetch(`${API_BASE}${path}`, { ...opts, headers })
      return retry.json()
    }
    if (logoutCallback) logoutCallback()
    throw new Error('Sesión expirada')
  }

  return res.json()
}

async function tryRefresh() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) return false
    const data = await res.json()
    if (data.success && data.data.accessToken) {
      accessToken = data.data.accessToken
      return true
    }
    return false
  } catch {
    return false
  }
}

export const auth = {
  async login(email, password) {
    const res = await request('POST', '/api/auth/login', { email, password })
    if (!res.success) throw new Error(res.error?.message || 'Error de login')
    setAccessToken(res.data.accessToken)
    return mapUserFromApi(res.data.user)
  },

  async register(data) {
    const res = await request('POST', '/api/auth/register', data)
    if (!res.success) throw new Error(res.error?.message || 'Error de registro')
    setAccessToken(res.data.accessToken)
    return mapUserFromApi(res.data.user)
  },

  async oauthGoogle({ access_token, email, nombre }) {
    const res = await request('POST', '/api/auth/oauth/google', { access_token, email, nombre })
    if (!res.success) throw new Error(res.error?.message || 'Error con Google OAuth')
    setAccessToken(res.data.accessToken)
    return mapUserFromApi(res.data.user)
  },

  async updateProfile(data) {
    const res = await request('PATCH', '/api/auth/profile', data)
    if (!res.success) throw new Error(res.error?.message || 'Error actualizando perfil')
    return mapUserFromApi(res.data)
  },

  async changePassword(data) {
    const res = await request('PATCH', '/api/auth/password', data)
    if (!res.success) throw new Error(res.error?.message || 'Error cambiando contraseña')
    return res.data
  },

  async logout() {
    try { await request('POST', '/api/auth/logout') } catch { /* ignore */ }
    clearAccessToken()
  },

  async me() {
    const res = await request('GET', '/api/auth/me')
    if (!res.success) return null
    return mapUserFromApi(res.data)
  },
}

export const products = {
  async getAll(filters = {}) {
    const params = new URLSearchParams()
    if (filters.page) params.set('page', filters.page)
    if (filters.pageSize) params.set('pageSize', filters.pageSize)
    if (filters.categoria) params.set('categoria', filters.categoria)
    if (filters.search) params.set('search', filters.search)
    if (filters.soloDisponibles) params.set('soloDisponibles', 'true')
    const qs = params.toString()
    const res = await request('GET', `/api/products${qs ? `?${qs}` : ''}`)
    if (!res.success) throw new Error(res.error?.message || 'Error cargando productos')
    return { data: res.data.map(mapProduct), meta: res.meta }
  },

  async getById(id) {
    const res = await request('GET', `/api/products/${id}`)
    if (!res.success) throw new Error(res.error?.message || 'Producto no encontrado')
    return mapProduct(res.data)
  },

  async getFeatured() {
    const res = await request('GET', '/api/products/featured')
    if (!res.success) throw new Error(res.error?.message || 'Error cargando productos')
    return res.data.map(mapProduct)
  },

  async getCategories() {
    const res = await request('GET', '/api/categories')
    if (!res.success) throw new Error(res.error?.message || 'Error cargando categorías')
    return res.data
  },
}

export const catalogos = {
  async getAll() {
    const res = await request('GET', '/api/catalogos')
    if (!res.success) throw new Error(res.error?.message || 'Error cargando catálogos')
    return res.data
  },
  async getById(id) {
    const res = await request('GET', `/api/catalogos/${id}`)
    if (!res.success) throw new Error(res.error?.message || 'Catálogo no encontrado')
    return res.data
  },
  async create(data) {
    const res = await request('POST', '/api/catalogos', data)
    if (!res.success) throw new Error(res.error?.message || 'Error creando catálogo')
    return res.data
  },
  async update(id, data) {
    const res = await request('PUT', `/api/catalogos/${id}`, data)
    if (!res.success) throw new Error(res.error?.message || 'Error actualizando catálogo')
    return res.data
  },
  async remove(id) {
    const res = await request('DELETE', `/api/catalogos/${id}`)
    if (!res.success) throw new Error(res.error?.message || 'Error eliminando catálogo')
    return res.data
  },
  async toggle(id) {
    const res = await request('POST', `/api/catalogos/${id}/toggle`)
    if (!res.success) throw new Error(res.error?.message || 'Error cambiando estado')
    return res.data
  },
  async addProductos(id, productos) {
    const res = await request('POST', `/api/catalogos/${id}/productos`, { productos })
    if (!res.success) throw new Error(res.error?.message || 'Error agregando productos')
    return res.data
  },
  async removeProducto(id, productId) {
    const res = await request('DELETE', `/api/catalogos/${id}/productos/${productId}`)
    if (!res.success) throw new Error(res.error?.message || 'Error quitando producto')
    return res.data
  },
  async getPublico(slug) {
    const res = await request('GET', `/api/catalogos/p/${slug}`)
    if (!res.success) return null
    return res.data
  },
}

function mapProduct(p) {
  return {
    id: p.id,
    ref: p.sku,
    nombre: p.nombre,
    descripcion: p.descripcion,
    precio: p.precio,
    precioPublico: p.precio,
    imagen: p.imagenes?.[0] || null,
    imagenes: p.imagenes || [],
    material: p.material,
    stock: p.stock,
    categoria: p.categoria?.nombre || '',
    categoriaSlug: p.categoria?.slug || '',
    isFeatured: p.isFeatured,
    tags: p.tags || [],
  }
}

export const orders = {
  async create(items, notas) {
    const res = await request('POST', '/api/orders', {
      items: items.map((i) => ({ productId: i.product.id, cantidad: i.cantidad })),
      notas,
    })
    if (!res.success) throw new Error(res.error?.message || 'Error creando orden')
    return res.data
  },

  async getAll(params = {}) {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', params.page)
    if (params.pageSize) qs.set('pageSize', params.pageSize)
    const qsStr = qs.toString()
    const res = await request('GET', `/api/orders${qsStr ? `?${qsStr}` : ''}`)
    if (!res.success) throw new Error(res.error?.message || 'Error cargando pedidos')
    return { data: res.data, meta: res.meta }
  },

  async getById(id) {
    const res = await request('GET', `/api/orders/${id}`)
    if (!res.success) throw new Error(res.error?.message || 'Orden no encontrada')
    return res.data
  },
}

export const admin = {
  async getStats() {
    const res = await request('GET', '/api/admin/users/stats')
    if (!res.success) throw new Error(res.error?.message || 'Error cargando stats')
    return res.data
  },

  async getUsers(params = {}) {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.pageSize) qs.set('pageSize', String(params.pageSize))
    if (params.search) qs.set('search', params.search)
    if (params.tier) qs.set('tier', params.tier)
    const qsStr = qs.toString()
    const res = await request('GET', `/api/admin/users${qsStr ? `?${qsStr}` : ''}`)
    if (!res.success) throw new Error(res.error?.message || 'Error cargando usuarios')
    return { data: res.data, meta: res.meta }
  },

  async getUser(id) {
    const res = await request('GET', `/api/admin/users/${id}`)
    if (!res.success) throw new Error(res.error?.message || 'Usuario no encontrado')
    return res.data
  },

  async changeTier(userId, tier) {
    const res = await request('PATCH', `/api/admin/users/${userId}/tier`, { tier })
    if (!res.success) throw new Error(res.error?.message || 'Error cambiando tier')
    return res.data
  },

  async getProducts(params = {}) {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.pageSize) qs.set('pageSize', String(params.pageSize))
    const qsStr = qs.toString()
    const res = await request('GET', `/api/admin/products${qsStr ? `?${qsStr}` : ''}`)
    if (!res.success) throw new Error(res.error?.message || 'Error cargando productos')
    return { data: res.data, meta: res.meta }
  },

  async createProduct(data) {
    const res = await request('POST', '/api/admin/products', data)
    if (!res.success) throw new Error(res.error?.message || 'Error creando producto')
    return res.data
  },

  async updateProduct(id, data) {
    const res = await request('PUT', `/api/admin/products/${id}`, data)
    if (!res.success) throw new Error(res.error?.message || 'Error actualizando producto')
    return res.data
  },

  async updateStock(id, stock) {
    const res = await request('PATCH', `/api/admin/products/${id}/stock`, { stock })
    if (!res.success) throw new Error(res.error?.message || 'Error actualizando stock')
    return res.data
  },

  async deleteProduct(id) {
    const res = await request('DELETE', `/api/admin/products/${id}`)
    if (!res.success) throw new Error(res.error?.message || 'Error eliminando producto')
    return res.data
  },

  async getOrders(params = {}) {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.pageSize) qs.set('pageSize', String(params.pageSize))
    if (params.status) qs.set('status', params.status)
    const qsStr = qs.toString()
    const res = await request('GET', `/api/admin/orders${qsStr ? `?${qsStr}` : ''}`)
    if (!res.success) throw new Error(res.error?.message || 'Error cargando órdenes')
    return { data: res.data, meta: res.meta }
  },

  async getOrder(id) {
    const res = await request('GET', `/api/admin/orders/${id}`)
    if (!res.success) throw new Error(res.error?.message || 'Orden no encontrada')
    return res.data
  },

  async updateOrderStatus(id, status) {
    const res = await request('PATCH', `/api/admin/orders/${id}/status`, { status })
    if (!res.success) throw new Error(res.error?.message || 'Error actualizando estado')
    return res.data
  },

  async getCategories() {
    const res = await request('GET', '/api/categories')
    if (!res.success) throw new Error(res.error?.message || 'Error cargando categorías')
    return res.data
  },
}
