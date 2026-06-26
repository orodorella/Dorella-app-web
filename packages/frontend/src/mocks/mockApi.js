import { users } from './users'

function delay(min = 300, max = 800) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function login(username) {
  await delay(400, 900)
  const user = users.find((u) => u.username === username)
  if (!user) throw new Error('Usuario no encontrado')
  return { ...user }
}

export async function confirmarOrden(carrito, user) {
  await delay(600, 1200)
  if (Math.random() < 0.08) {
    throw new Error('Error de conexión. Intenta nuevamente.')
  }
  const numero = 'ORD-' + Date.now().toString(36).toUpperCase()
  return {
    numeroOrden: numero,
    fecha: new Date().toLocaleDateString('es-CO'),
    estado: 'Confirmado',
    items: carrito.length,
  }
}

export async function generarFactura(ordenId) {
  await delay(300, 600)
  return {
    numeroFactura: 'FAC-' + Math.floor(Math.random() * 900000 + 100000),
    ordenId,
    fecha: new Date().toLocaleDateString('es-CO'),
  }
}

export async function generarSeguimiento(ordenId) {
  await delay(200, 500)
  return {
    codigo: 'TCC-' + Math.floor(Math.random() * 9000000000 + 1000000000),
    transportadora: 'TCC',
    ordenId,
    estimado: '3-5 días hábiles',
  }
}
