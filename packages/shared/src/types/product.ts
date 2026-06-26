export interface Category {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  imagenUrl: string | null;
  orden: number;
  isActive: boolean;
}

export interface Product {
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
  categoria: Pick<Category, 'id' | 'nombre' | 'slug'>;
}

export interface AdminProduct extends Omit<Product, 'precio'> {
  precioBase: number;
  precio: number;
  stockReservado: number;
  pesoGramos: number | null;
  alegraItemId: string | null;
  isActive: boolean;
}
