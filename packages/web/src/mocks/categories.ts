export interface MockCategory {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  imagenUrl: string | null;
  orden: number;
  isActive: boolean;
}

export const mockCategories: MockCategory[] = [
  { id: 'cat-aretes', nombre: 'Aretes', slug: 'aretes', descripcion: 'Aretes en oro laminado 18k.', imagenUrl: null, orden: 1, isActive: true },
  { id: 'cat-cadenas', nombre: 'Cadenas', slug: 'cadenas', descripcion: 'Cadenas para uso diario y ocasiones especiales.', imagenUrl: null, orden: 2, isActive: true },
  { id: 'cat-anillos', nombre: 'Anillos', slug: 'anillos', descripcion: 'Anillos con acabado premium.', imagenUrl: null, orden: 3, isActive: true },
  { id: 'cat-pulseras', nombre: 'Pulseras', slug: 'pulseras', descripcion: 'Pulseras y brazaletes laminados.', imagenUrl: null, orden: 4, isActive: true },
  { id: 'cat-dijes', nombre: 'Dijes', slug: 'dijes', descripcion: 'Dijes para personalizar cada look.', imagenUrl: null, orden: 5, isActive: true },
  { id: 'cat-conjuntos', nombre: 'Conjuntos', slug: 'conjuntos', descripcion: 'Conjuntos listos para vender.', imagenUrl: null, orden: 6, isActive: true },
];
