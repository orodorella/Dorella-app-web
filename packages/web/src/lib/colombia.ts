import divipola from '../data/divipola-municipios.json';

/**
 * Catálogo DIVIPOLA (DANE) versionado en `src/data/divipola-municipios.json`.
 * Sin APIs externas ni claves. Búsqueda sin distinguir mayúsculas ni tildes.
 */

export interface Municipio {
  /** Código DIVIPOLA de 5 dígitos (2 de departamento + 3 de municipio). */
  codigo: string;
  nombre: string;
  codigoDepartamento: string;
  departamento: string;
}

export const DIVIPOLA_FUENTE = { fuente: divipola.fuente, descargado: divipola.descargado, total: divipola.total };

/** Minúsculas, sin tildes ni signos, espacios colapsados. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Indexado extends Municipio {
  /** Capital departamental (DIVIPOLA: código de municipio terminado en 001). */
  capital: boolean;
  n: string;
  d: string;
  palabras: string[];
}

const INDICE: Indexado[] = (divipola.municipios as string[][]).map(([codigo, nombre, codigoDepartamento, departamento]) => ({
  codigo, nombre, codigoDepartamento, departamento,
  capital: codigo.endsWith('001'),
  n: normalizar(nombre),
  d: normalizar(departamento),
  palabras: normalizar(nombre).split(' '),
}));

const POR_CODIGO = new Map(INDICE.map((m) => [m.codigo, m]));

const publico = (m: Indexado): Municipio => ({
  codigo: m.codigo, nombre: m.nombre, codigoDepartamento: m.codigoDepartamento, departamento: m.departamento,
});

export function municipioPorCodigo(codigo: string | null | undefined): Municipio | null {
  const m = codigo ? POR_CODIGO.get(codigo) : undefined;
  return m ? publico(m) : null;
}

export const MIN_CARACTERES_BUSQUEDA = 2;

/** Nombres corrientes que el DANE escribe distinto o que comparten prefijo con otro municipio. */
const ALIAS_CIUDADES: Record<string, string> = { bogota: '11001', cartagena: '13001' };

/**
 * Coincidencias parciales por municipio y/o departamento ("cali valle" sirve).
 * Orden: el nombre empieza por la búsqueda, luego alguna palabra del nombre empieza
 * por ella, luego la contiene. Desempata alfabéticamente.
 */
export function buscarMunicipios(consulta: string, limite = 40): Municipio[] {
  const q = normalizar(consulta);
  if (q.length < MIN_CARACTERES_BUSQUEDA) return [];
  const tokens = q.split(' ');

  const resultados: Array<{ m: Indexado; puntaje: number }> = [];
  for (const m of INDICE) {
    let puntaje = 0;
    let ok = true;
    tokens.forEach((token, i) => {
      if (!ok) return;
      let p: number;
      // Una palabra exacta ('cali' en 'Santiago de Cali') gana sobre un prefijo ('Calima').
      if (m.palabras.includes(token)) p = -1;
      else if (m.n.startsWith(token)) p = 0;
      // Las capitales cuentan como prefijo aunque su nombre oficial empiece distinto (Santiago de Cali).
      else if (m.palabras.some((w) => w.startsWith(token))) p = i === 0 && m.capital ? 0 : 1;
      else if (m.n.includes(token)) p = 3;
      else if (m.d.split(' ').some((w) => w.startsWith(token))) p = i === 0 ? 4 : 2;
      else { ok = false; return; }
      puntaje += i === 0 ? p * 10 : p; // el primer término manda; los demás desempatan
    });
    if (ok) resultados.push({ m, puntaje });
  }

  // A igual puntaje, primero las capitales (lo que casi siempre se busca) y luego alfabético.
  resultados.sort((a, b) => a.puntaje - b.puntaje || Number(b.m.capital) - Number(a.m.capital) || a.m.n.localeCompare(b.m.n, 'es'));
  return resultados.slice(0, limite).map(({ m }) => publico(m));
}

/**
 * Compatibilidad con registros anteriores (ciudad guardada como texto libre):
 * devuelve el municipio solo si hay UNA coincidencia clara. Si hay varias y el
 * departamento no desambigua, devuelve null (no se adivina).
 */
export function resolverMunicipioHistorico(ciudad: string | null | undefined, departamento?: string | null): Municipio | null {
  const c = normalizar(ciudad ?? '');
  if (!c) return null;
  let candidatos = INDICE.filter((m) => m.n === c);
  if (candidatos.length === 0) {
    // "Cali" ↔ "Santiago de Cali", "Cúcuta" ↔ "San José de Cúcuta": el nombre termina en lo escrito.
    candidatos = INDICE.filter((m) => m.n.endsWith(` ${c}`));
  }
  if (candidatos.length === 0) {
    // "Bogotá" ↔ "Bogotá, D.C.": el nombre oficial empieza por lo escrito.
    candidatos = INDICE.filter((m) => m.n.startsWith(`${c} `));
  }
  const d = normalizar(departamento ?? '');
  // Alias universales (Cartagena = Cartagena de Indias), solo si el departamento no lo contradice.
  const alias = ALIAS_CIUDADES[c];
  if (candidatos.length !== 1 && alias) {
    const m = POR_CODIGO.get(alias);
    if (m && (!d || m.d === d || m.d.startsWith(d) || d.startsWith(m.d))) return publico(m);
  }
  if (candidatos.length > 1 && d) candidatos = candidatos.filter((m) => m.d === d || m.d.startsWith(d) || d.startsWith(m.d));
  return candidatos.length === 1 ? publico(candidatos[0]) : null;
}

export const PAISES = [
  'Colombia', 'Ecuador', 'Perú', 'Venezuela', 'Panamá', 'México', 'Chile', 'Argentina', 'Brasil',
  'Costa Rica', 'República Dominicana', 'Estados Unidos', 'España', 'Otro',
] as const;

export const PAIS_POR_DEFECTO = 'Colombia';

/**
 * Separa un nombre guardado en un solo campo ("Sebastián Rubio") de forma conservadora:
 * solo divide cuando son exactamente dos palabras. Con tres o más es ambiguo
 * (¿"María José Pérez" o "Juan Pérez Gómez"?): se deja todo en `nombre` y se avisa
 * para que la persona lo corrija.
 */
export function separarNombre(nombre: string | null | undefined, apellido: string | null | undefined): { nombre: string; apellido: string; ambiguo: boolean } {
  const n = (nombre ?? '').trim().replace(/\s+/g, ' ');
  const a = (apellido ?? '').trim().replace(/\s+/g, ' ');
  if (a) return { nombre: n, apellido: a, ambiguo: false };
  const partes = n.split(' ').filter(Boolean);
  if (partes.length === 2) return { nombre: partes[0], apellido: partes[1], ambiguo: false };
  return { nombre: n, apellido: '', ambiguo: partes.length > 2 };
}
