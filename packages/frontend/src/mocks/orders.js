const orders = [
  {
    id: 1,
    numeroOrden: 'ORD-2025-0847',
    fecha: '15/06/2025',
    estado: 'Entregado',
    total: 1245600,
    items: [
      { productId: 1, ref: 'AR-001', nombre: 'Aretes Gota Imperial', cantidad: 10, precioUnit: 30563 },
      { productId: 6, ref: 'CD-001', nombre: 'Cadena Eslabón Cubano 50cm', cantidad: 5, precioUnit: 56188 },
      { productId: 16, ref: 'PU-001', nombre: 'Pulsera Tennis Brillantes', cantidad: 8, precioUnit: 59938 },
    ],
  },
  {
    id: 2,
    numeroOrden: 'ORD-2025-0912',
    fecha: '18/06/2025',
    estado: 'Enviado',
    total: 876400,
    items: [
      { productId: 11, ref: 'AN-001', nombre: 'Anillo Solitario Marquesa', cantidad: 6, precioUnit: 43063 },
      { productId: 3, ref: 'AR-003', nombre: 'Aretes Candongas Florencia', cantidad: 12, precioUnit: 33063 },
      { productId: 21, ref: 'DJ-001', nombre: 'Dije Corazón Locket', cantidad: 15, precioUnit: 26813 },
    ],
  },
  {
    id: 3,
    numeroOrden: 'ORD-2025-0958',
    fecha: '20/06/2025',
    estado: 'Confirmado',
    total: 534700,
    items: [
      { productId: 26, ref: 'CJ-001', nombre: 'Conjunto Lluvia de Estrellas', cantidad: 2, precioUnit: 89313 },
      { productId: 5, ref: 'AR-005', nombre: 'Aretes Botón Perla Venecia', cantidad: 20, precioUnit: 18063 },
    ],
  },
  {
    id: 4,
    numeroOrden: 'ORD-2025-0971',
    fecha: '21/06/2025',
    estado: 'Pendiente',
    total: 389500,
    items: [
      { productId: 7, ref: 'CD-002', nombre: 'Cadena Figaro Clásica 45cm', cantidad: 4, precioUnit: 47438 },
      { productId: 12, ref: 'AN-002', nombre: 'Anillo Cintillo Circones', cantidad: 5, precioUnit: 28688 },
    ],
  },
]

export { orders }
