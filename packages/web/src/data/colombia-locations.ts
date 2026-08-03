export type ColombiaDepartment = {
  department: string;
  cities: string[];
};

export const COLOMBIA_LOCATIONS: ColombiaDepartment[] = [
  { department: 'Amazonas', cities: ['Leticia', 'Puerto Narino'] },
  { department: 'Antioquia', cities: ['Medellin', 'Bello', 'Envigado', 'Itagui', 'Rionegro', 'Sabaneta', 'Apartado', 'Turbo', 'Caucasia'] },
  { department: 'Arauca', cities: ['Arauca', 'Saravena', 'Tame'] },
  { department: 'Atlantico', cities: ['Barranquilla', 'Soledad', 'Malambo', 'Puerto Colombia', 'Baranoa', 'Sabanalarga'] },
  { department: 'Bolivar', cities: ['Cartagena', 'Magangue', 'Turbaco', 'Arjona', 'El Carmen de Bolivar'] },
  { department: 'Boyaca', cities: ['Tunja', 'Duitama', 'Sogamoso', 'Chiquinquira', 'Paipa', 'Villa de Leyva'] },
  { department: 'Caldas', cities: ['Manizales', 'Villamaria', 'Chinchina', 'La Dorada', 'Riosucio'] },
  { department: 'Caqueta', cities: ['Florencia', 'San Vicente del Caguan'] },
  { department: 'Casanare', cities: ['Yopal', 'Aguazul', 'Villanueva', 'Paz de Ariporo'] },
  { department: 'Cauca', cities: ['Popayan', 'Santander de Quilichao', 'Puerto Tejada', 'Patia'] },
  { department: 'Cesar', cities: ['Valledupar', 'Aguachica', 'Bosconia', 'Codazzi'] },
  { department: 'Choco', cities: ['Quibdo', 'Istmina', 'Condoto'] },
  { department: 'Cordoba', cities: ['Monteria', 'Cereté', 'Sahagun', 'Lorica', 'Montelibano'] },
  { department: 'Cundinamarca', cities: ['Soacha', 'Zipaquira', 'Facatativa', 'Chia', 'Mosquera', 'Funza', 'Girardot', 'Fusagasuga', 'Cajica', 'Madrid'] },
  { department: 'Bogota D.C.', cities: ['Bogota'] },
  { department: 'Guainia', cities: ['Inirida'] },
  { department: 'Guaviare', cities: ['San Jose del Guaviare'] },
  { department: 'Huila', cities: ['Neiva', 'Pitalito', 'Garzon', 'La Plata'] },
  { department: 'La Guajira', cities: ['Riohacha', 'Maicao', 'Fonseca', 'San Juan del Cesar'] },
  { department: 'Magdalena', cities: ['Santa Marta', 'Cienaga', 'Fundacion', 'El Banco'] },
  { department: 'Meta', cities: ['Villavicencio', 'Acacias', 'Granada', 'Puerto Lopez'] },
  { department: 'Narino', cities: ['Pasto', 'Ipiales', 'Tumaco', 'Tuquerres'] },
  { department: 'Norte de Santander', cities: ['Cucuta', 'Ocana', 'Villa del Rosario', 'Pamplona', 'Los Patios'] },
  { department: 'Putumayo', cities: ['Mocoa', 'Puerto Asis', 'Orito'] },
  { department: 'Quindio', cities: ['Armenia', 'Calarca', 'La Tebaida', 'Montenegro', 'Quimbaya'] },
  { department: 'Risaralda', cities: ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal', 'La Virginia'] },
  { department: 'San Andres y Providencia', cities: ['San Andres', 'Providencia'] },
  { department: 'Santander', cities: ['Bucaramanga', 'Floridablanca', 'Giron', 'Piedecuesta', 'Barrancabermeja', 'San Gil'] },
  { department: 'Sucre', cities: ['Sincelejo', 'Corozal', 'Sampues', 'San Marcos'] },
  { department: 'Tolima', cities: ['Ibague', 'Espinal', 'Melgar', 'Honda', 'Chaparral'] },
  { department: 'Valle del Cauca', cities: ['Cali', 'Palmira', 'Buenaventura', 'Tulua', 'Buga', 'Jamundi', 'Cartago', 'Yumbo'] },
  { department: 'Vaupes', cities: ['Mitu'] },
  { department: 'Vichada', cities: ['Puerto Carreno'] },
];

export const COLOMBIA_DEPARTMENTS = COLOMBIA_LOCATIONS.map((location) => location.department);

export function getCitiesByDepartment(department: string) {
  const normalizedDepartment = normalizeLocationValue(department);
  return (
    COLOMBIA_LOCATIONS.find((location) => normalizeLocationValue(location.department) === normalizedDepartment)?.cities ?? []
  );
}

export function normalizeLocationValue(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeDepartment(department: string) {
  const normalizedDepartment = normalizeLocationValue(department);
  return (
    COLOMBIA_LOCATIONS.find((location) => normalizeLocationValue(location.department) === normalizedDepartment)?.department ?? ''
  );
}

export function normalizeCityForDepartment(department: string, city: string) {
  const cities = getCitiesByDepartment(department);
  const normalizedCity = normalizeLocationValue(city);
  return cities.find((item) => normalizeLocationValue(item) === normalizedCity) ?? '';
}

export function isValidCityForDepartment(department: string, city: string) {
  if (!department.trim() || !city.trim()) return false;
  return Boolean(normalizeCityForDepartment(department, city));
}
