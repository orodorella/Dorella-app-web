const categoryMap = {
  aretes: { id: 'cat-aretes', nombre: 'Aretes', slug: 'aretes' },
  cadenas: { id: 'cat-cadenas', nombre: 'Cadenas', slug: 'cadenas' },
  anillos: { id: 'cat-anillos', nombre: 'Anillos', slug: 'anillos' },
  pulseras: { id: 'cat-pulseras', nombre: 'Pulseras', slug: 'pulseras' },
  dijes: { id: 'cat-dijes', nombre: 'Dijes', slug: 'dijes' },
  conjuntos: { id: 'cat-conjuntos', nombre: 'Conjuntos', slug: 'conjuntos' },
} as const;

export interface MockProduct {
  id: string;
  sku: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  imagenes: string[];
  material: string | null;
  stock: number;
  isFeatured: boolean;
  tags: string[];
  categoria: { id: string; nombre: string; slug: string };
}

export const mockProducts: MockProduct[] = [
  { id: 'mock-ar-001', sku: 'AR-001', nombre: 'Aretes Gota Imperial', descripcion: 'Aretes tipo candonga con brillo central y acabado premium para uso diario.', precio: 48900, imagenes: [], material: 'Oro laminado 18k', stock: 120, isFeatured: true, tags: ['candongas', 'premium'], categoria: categoryMap.aretes },
  { id: 'mock-ar-002', sku: 'AR-002', nombre: 'Aretes Argolla Milan', descripcion: 'Argollas ligeras con silueta clasica y presencia comercial.', precio: 35900, imagenes: [], material: 'Oro laminado 18k', stock: 200, isFeatured: false, tags: ['argollas'], categoria: categoryMap.aretes },
  { id: 'mock-cd-001', sku: 'CD-001', nombre: 'Cadena Eslabon Cubano 50cm', descripcion: 'Cadena gruesa con brillo uniforme y excelente salida comercial.', precio: 89900, imagenes: [], material: 'Oro laminado 18k - 30 micras', stock: 60, isFeatured: true, tags: ['cadena', 'cubano'], categoria: categoryMap.cadenas },
  { id: 'mock-cd-002', sku: 'CD-002', nombre: 'Cadena Figaro Clasica 45cm', descripcion: 'Modelo Figaro de alta rotacion con presencia elegante.', precio: 75900, imagenes: [], material: 'Oro laminado 18k - 30 micras', stock: 90, isFeatured: false, tags: ['figaro'], categoria: categoryMap.cadenas },
  { id: 'mock-an-001', sku: 'AN-001', nombre: 'Anillo Solitario Marquesa', descripcion: 'Anillo delicado con piedra tipo marquesa para venta detal y regalo.', precio: 68900, imagenes: [], material: 'Oro laminado 18k con circones', stock: 75, isFeatured: true, tags: ['anillo', 'circones'], categoria: categoryMap.anillos },
  { id: 'mock-an-002', sku: 'AN-002', nombre: 'Anillo Cintillo Circones', descripcion: 'Cintillo versatil con acabado brillante y excelente rotacion.', precio: 45900, imagenes: [], material: 'Oro laminado 18k con circones', stock: 160, isFeatured: false, tags: ['cintillo'], categoria: categoryMap.anillos },
  { id: 'mock-pu-001', sku: 'PU-001', nombre: 'Pulsera Tennis Brillantes', descripcion: 'Pulsera tipo tennis para cliente que busca una pieza mas protagonista.', precio: 95900, imagenes: [], material: 'Oro laminado 18k con circones', stock: 40, isFeatured: true, tags: ['tennis'], categoria: categoryMap.pulseras },
  { id: 'mock-pu-002', sku: 'PU-002', nombre: 'Pulsera Eslabon Grueso', descripcion: 'Pulsera con look comercial y alto valor percibido.', precio: 72900, imagenes: [], material: 'Oro laminado 18k - 30 micras', stock: 70, isFeatured: false, tags: ['eslabon'], categoria: categoryMap.pulseras },
  { id: 'mock-dj-001', sku: 'DJ-001', nombre: 'Dije Corazon Locket', descripcion: 'Dije romantico con gran salida en fechas especiales.', precio: 42900, imagenes: [], material: 'Oro laminado 18k', stock: 180, isFeatured: false, tags: ['dije', 'corazon'], categoria: categoryMap.dijes },
  { id: 'mock-dj-002', sku: 'DJ-002', nombre: 'Dije Cruz Bizantina', descripcion: 'Dije clasico con acabado pulido y estilo tradicional.', precio: 38900, imagenes: [], material: 'Oro laminado 18k', stock: 200, isFeatured: false, tags: ['cruz'], categoria: categoryMap.dijes },
  { id: 'mock-cj-001', sku: 'CJ-001', nombre: 'Conjunto Lluvia de Estrellas', descripcion: 'Conjunto listo para vender con alto ticket promedio.', precio: 142900, imagenes: [], material: 'Oro laminado 18k con circones', stock: 30, isFeatured: true, tags: ['conjunto'], categoria: categoryMap.conjuntos },
  { id: 'mock-cj-002', sku: 'CJ-002', nombre: 'Conjunto Clasico Dorado', descripcion: 'Set premium con apariencia de lujo y margen comercial atractivo.', precio: 155900, imagenes: [], material: 'Oro laminado 18k - 30 micras', stock: 20, isFeatured: true, tags: ['set', 'premium'], categoria: categoryMap.conjuntos },
];
