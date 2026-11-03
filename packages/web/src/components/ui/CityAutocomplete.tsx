'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { buscarMunicipios, MIN_CARACTERES_BUSQUEDA, type Municipio } from '@/lib/colombia';

interface Props {
  label: string;
  /** Municipio ya elegido (con código DIVIPOLA), si lo hay. */
  value: Municipio | null;
  /** Texto histórico guardado sin código (se conserva visible hasta que se elija un municipio). */
  legacyText?: string;
  required?: boolean;
  onSelect: (municipio: Municipio | null) => void;
}

/** Combobox accesible (patrón ARIA "listbox popup"): teclado, mouse y táctil. */
export default function CityAutocomplete({ label, value, legacyText = '', required, onSelect }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const contenedor = useRef<HTMLDivElement>(null);

  const opciones = useMemo(() => buscarMunicipios(texto, 40), [texto]);
  const mostrarVacio = abierto && texto.trim().length >= MIN_CARACTERES_BUSQUEDA && opciones.length === 0;

  useEffect(() => setActivo(0), [texto]);

  // Mantiene visible la opción activa al navegar con flechas.
  useEffect(() => {
    if (abierto && opciones[activo]) document.getElementById(`${id}-opt-${opciones[activo].codigo}`)?.scrollIntoView({ block: 'nearest' });
  }, [activo, abierto, opciones, id]);

  useEffect(() => {
    function fuera(event: MouseEvent | TouchEvent) {
      if (!contenedor.current?.contains(event.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', fuera);
    document.addEventListener('touchstart', fuera);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('touchstart', fuera);
    };
  }, []);

  function elegir(municipio: Municipio) {
    onSelect(municipio);
    setTexto('');
    setAbierto(false);
  }

  function teclado(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setAbierto(true);
      setActivo((i) => Math.min(i + 1, Math.max(opciones.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setAbierto(true);
      setActivo((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Home' && abierto) {
      event.preventDefault();
      setActivo(0);
    } else if (event.key === 'End' && abierto) {
      event.preventDefault();
      setActivo(Math.max(opciones.length - 1, 0));
    } else if (event.key === 'Enter' && abierto && opciones[activo]) {
      event.preventDefault();
      elegir(opciones[activo]);
    } else if (event.key === 'Escape') {
      setAbierto(false);
      setTexto('');
    }
  }

  const inputClass = 'w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-wine/40 focus:outline-none';

  return (
    <div ref={contenedor} className="relative">
      <label htmlFor={id} className="mb-1 block text-[10px] uppercase tracking-wider text-stone-500">{label}</label>
      {/* Anuncia a lectores de pantalla cuántos resultados hay. */}
      <p className="sr-only" role="status" aria-live="polite">
        {abierto && texto.trim().length >= MIN_CARACTERES_BUSQUEDA ? (opciones.length ? `${opciones.length} resultados disponibles` : 'Sin coincidencias') : ''}
      </p>

      {value ? (
        <div role="group" aria-label={`${label}: ${value.nombre}, ${value.departamento}`} className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-sm">
          <span className="flex min-w-0 items-center gap-2 text-stone-700">
            <Check size={14} className="shrink-0 text-emerald-600" aria-hidden />
            <span className="truncate">{value.nombre} <span className="text-stone-400">· {value.departamento}</span></span>
          </span>
          <button
            type="button" onClick={() => onSelect(null)} aria-label={`Cambiar ${label.toLowerCase()}`}
            className="cursor-pointer rounded p-1 text-stone-400 hover:text-wine"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <input
            id={id}
            type="text"
            role="combobox"
            aria-expanded={abierto}
            aria-haspopup="listbox"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={abierto && opciones[activo] ? `${id}-opt-${opciones[activo].codigo}` : undefined}
            autoComplete="off"
            required={required && !legacyText}
            value={texto}
            placeholder={legacyText ? `Guardada: ${legacyText} — elige un municipio` : 'Escribe 2 letras…'}
            onChange={(e) => { setTexto(e.target.value); setAbierto(true); }}
            onFocus={() => setAbierto(true)}
            onKeyDown={teclado}
            className={inputClass}
          />
          {legacyText ? (
            <p className="mt-1 text-[11px] text-amber-700">Ciudad guardada como texto: «{legacyText}». Elige el municipio para registrar su código.</p>
          ) : null}
        </>
      )}

      {!value && abierto && (opciones.length > 0 || mostrarVacio) ? (
        <ul
          id={listId} role="listbox" aria-label={`Resultados de ${label.toLowerCase()}`}
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
        >
          {opciones.map((municipio, index) => (
            <li
              key={municipio.codigo}
              id={`${id}-opt-${municipio.codigo}`}
              role="option"
              aria-selected={index === activo}
              // mousedown no quita el foco al input; la selección se hace en click, que en táctil solo
              // ocurre con un toque (no al arrastrar para desplazar la lista).
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(municipio)}
              onMouseEnter={() => setActivo(index)}
              className={`cursor-pointer px-3 py-3 text-sm sm:py-2 ${index === activo ? 'bg-champagne/40 text-wine' : 'text-stone-700'}`}
            >
              {municipio.nombre} <span className="text-stone-400">· {municipio.departamento}</span>
            </li>
          ))}
          {mostrarVacio ? <li role="presentation" className="px-3 py-3 text-sm text-stone-400">Sin coincidencias en Colombia.</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
