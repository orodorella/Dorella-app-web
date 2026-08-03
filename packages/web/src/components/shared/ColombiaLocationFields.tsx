'use client';

import { useId, useMemo } from 'react';
import {
  COLOMBIA_DEPARTMENTS,
  getCitiesByDepartment,
  normalizeCityForDepartment,
  normalizeDepartment,
} from '@/data/colombia-locations';

type Props = {
  department: string;
  city: string;
  onDepartmentChange: (value: string) => void;
  onCityChange: (value: string) => void;
  departmentError?: string;
  cityError?: string;
};

export function ColombiaLocationFields({
  department,
  city,
  onDepartmentChange,
  onCityChange,
  departmentError,
  cityError,
}: Props) {
  const datalistId = useId();

  const normalizedDepartment = normalizeDepartment(department);
  const cityOptions = useMemo(
    () => getCitiesByDepartment(normalizedDepartment || department),
    [department, normalizedDepartment],
  );

  return (
    <>
      <div>
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
          Departamento
        </label>
        <select
          value={normalizedDepartment || department}
          onChange={(event) => {
            const nextDepartment = event.target.value;
            const normalizedCity = normalizeCityForDepartment(nextDepartment, city);

            onDepartmentChange(nextDepartment);
            if (!normalizedCity) {
              onCityChange('');
              return;
            }

            onCityChange(normalizedCity);
          }}
          className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20 ${
            departmentError ? 'border-red-300' : 'border-stone-200'
          }`}
        >
          <option value="">Selecciona un departamento</option>
          {COLOMBIA_DEPARTMENTS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        {departmentError && <p className="mt-2 text-xs text-red-500">{departmentError}</p>}
      </div>

      <div>
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
          Ciudad
        </label>
        <input
          list={datalistId}
          value={city}
          onChange={(event) => onCityChange(event.target.value)}
          onBlur={() => {
            const normalizedCity = normalizeCityForDepartment(normalizedDepartment || department, city);
            if (normalizedCity) {
              onCityChange(normalizedCity);
            }
          }}
          placeholder={normalizedDepartment ? 'Busca o selecciona una ciudad' : 'Selecciona primero un departamento'}
          className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20 ${
            cityError ? 'border-red-300' : 'border-stone-200'
          }`}
        />
        <datalist id={datalistId}>
          {cityOptions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
        {cityError ? (
          <p className="mt-2 text-xs text-red-500">{cityError}</p>
        ) : normalizedDepartment ? (
          <p className="mt-2 text-xs text-stone-400">Veras solo ciudades del departamento seleccionado.</p>
        ) : (
          <p className="mt-2 text-xs text-stone-400">Elige el departamento para filtrar las ciudades disponibles.</p>
        )}
      </div>
    </>
  );
}
