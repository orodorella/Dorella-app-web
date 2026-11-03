import { describe, expect, it } from 'vitest';
// Módulo puro del frontend (catálogo DIVIPOLA local): se prueba aquí porque el repo solo tiene corredor de pruebas en el API.
import {
  buscarMunicipios, municipioPorCodigo, normalizar, resolverMunicipioHistorico, separarNombre, DIVIPOLA_FUENTE,
} from '../../../web/src/lib/colombia';
import divipola from '../../../web/src/data/divipola-municipios.json';

const nombres = (consulta: string, limite = 200) => buscarMunicipios(consulta, limite).map((m) => normalizar(m.nombre));

describe('catálogo DIVIPOLA versionado', () => {
  it('tiene los 1.122 municipios con códigos únicos de 5 dígitos y 33 departamentos', () => {
    const filas = divipola.municipios as string[][];
    expect(filas).toHaveLength(DIVIPOLA_FUENTE.total);
    expect(filas.length).toBeGreaterThanOrEqual(1100);
    expect(new Set(filas.map((f) => f[0])).size).toBe(filas.length);
    expect(filas.every((f) => /^\d{5}$/.test(f[0]) && f[0].startsWith(f[2]))).toBe(true);
    expect(new Set(filas.map((f) => f[2])).size).toBe(33);
    expect(divipola.fuente).toMatch(/DIVIPOLA/);
  });
});

describe('autocompletado de ciudades', () => {
  it('desde dos caracteres: "ca" incluye Cali, Calarcá y Cajicá', () => {
    const encontrados = nombres('ca');
    expect(encontrados).toContain('santiago de cali');
    expect(encontrados).toContain('calarca');
    expect(encontrados).toContain('cajica');
  });

  it('con la lista visible (40 opciones) «ca» muestra Cali entre las primeras y también Calarcá y Cajicá', () => {
    const lista = buscarMunicipios('ca', 40).map((m) => normalizar(m.nombre));
    expect(lista.slice(0, 5)).toContain('santiago de cali');
    expect(lista).toContain('calarca');
    expect(lista).toContain('cajica');
    expect(lista.length).toBe(40);
  });

  it('con menos de dos caracteres no busca', () => {
    expect(buscarMunicipios('c')).toEqual([]);
    expect(buscarMunicipios('  ')).toEqual([]);
    expect(buscarMunicipios('')).toEqual([]);
  });

  it('ignora mayúsculas y tildes en ambos sentidos', () => {
    for (const variante of ['cucuta', 'CÚCUTA', 'Cúcuta', 'cúcuta']) {
      expect(nombres(variante)).toContain('san jose de cucuta');
    }
    expect(nombres('MEDELLIN')).toContain('medellin');
    expect(nombres('bogota')).toContain('bogota d c');
    expect(nombres('Calarca')).toContain('calarca');
  });

  it('coincidencias parciales: el nombre que empieza por la búsqueda va primero', () => {
    const [primero] = buscarMunicipios('barranq');
    expect(normalizar(primero.nombre)).toBe('barranquilla');
    expect(normalizar(buscarMunicipios('cali')[0].nombre)).toBe('santiago de cali');
    expect(normalizar(buscarMunicipios('cucuta')[0].nombre)).toBe('san jose de cucuta');
  });

  it('muestra municipio y departamento, y entrega el código DIVIPOLA', () => {
    const cali = buscarMunicipios('cali valle')[0];
    expect(cali).toMatchObject({ codigo: '76001', departamento: 'Valle del Cauca', codigoDepartamento: '76' });
    expect(municipioPorCodigo('76001')?.nombre).toBe(cali.nombre);
    expect(municipioPorCodigo('99999')).toBeNull();
    expect(municipioPorCodigo(null)).toBeNull();
  });

  it('respeta el límite de resultados y no devuelve nada si no hay coincidencias', () => {
    expect(buscarMunicipios('ca', 5)).toHaveLength(5);
    expect(buscarMunicipios('zzzzqq')).toEqual([]);
  });
});

describe('compatibilidad con ciudades guardadas como texto', () => {
  it('resuelve nombres cortos solo si la coincidencia es única', () => {
    expect(resolverMunicipioHistorico('Cali', 'Valle del Cauca')?.codigo).toBe('76001');
    expect(resolverMunicipioHistorico('cúcuta')?.codigo).toBe('54001');
    expect(resolverMunicipioHistorico('MEDELLÍN', 'Antioquia')?.codigo).toBe('05001');
  });

  it('no adivina cuando hay varios municipios con el mismo nombre', () => {
    expect(resolverMunicipioHistorico('San Andrés')).toBeNull();
    expect(resolverMunicipioHistorico('San Andrés', 'Santander')?.codigo).toBe('68669');
  });

  it('resuelve Bogotá y Cartagena (nombres oficiales distintos) sin contradecir el departamento', () => {
    expect(resolverMunicipioHistorico('Bogotá')?.codigo).toBe('11001');
    expect(resolverMunicipioHistorico('bogota d.c.')?.codigo).toBe('11001');
    expect(resolverMunicipioHistorico('Cartagena')?.codigo).toBe('13001');
    expect(resolverMunicipioHistorico('Cartagena', 'Bolívar')?.codigo).toBe('13001');
    // "Cartagena" con departamento Caquetá es Cartagena del Chairá, no la alias
    expect(resolverMunicipioHistorico('Cartagena', 'Caquetá')?.codigo).not.toBe('13001');
  });

  it('devuelve null para texto desconocido o vacío (el valor histórico se conserva tal cual)', () => {
    expect(resolverMunicipioHistorico('Ciudad Inventada')).toBeNull();
    expect(resolverMunicipioHistorico('')).toBeNull();
    expect(resolverMunicipioHistorico(null)).toBeNull();
  });
});

describe('nombres y apellidos', () => {
  it('separa "Sebastián Rubio" guardado en un solo campo', () => {
    expect(separarNombre('Sebastián Rubio', '')).toEqual({ nombre: 'Sebastián', apellido: 'Rubio', ambiguo: false });
    expect(separarNombre('  Sebastián   Rubio ', null)).toEqual({ nombre: 'Sebastián', apellido: 'Rubio', ambiguo: false });
  });

  it('respeta los campos estructurados cuando existen', () => {
    expect(separarNombre('María José', 'Pérez Gómez')).toEqual({ nombre: 'María José', apellido: 'Pérez Gómez', ambiguo: false });
  });

  it('con tres o más palabras no adivina: deja todo en nombre y avisa', () => {
    expect(separarNombre('María José Pérez', '')).toEqual({ nombre: 'María José Pérez', apellido: '', ambiguo: true });
    expect(separarNombre('Juan Carlos Pérez Gómez', '')).toMatchObject({ apellido: '', ambiguo: true });
  });

  it('una sola palabra o vacío no inventa apellido', () => {
    expect(separarNombre('Madonna', '')).toEqual({ nombre: 'Madonna', apellido: '', ambiguo: false });
    expect(separarNombre('', '')).toEqual({ nombre: '', apellido: '', ambiguo: false });
    expect(separarNombre(null, undefined)).toEqual({ nombre: '', apellido: '', ambiguo: false });
  });
});
