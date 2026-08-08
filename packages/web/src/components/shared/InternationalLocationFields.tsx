'use client';

import { useMemo } from 'react';
import {
  COUNTRY_OPTIONS,
  getCityLabel,
  getCityOptions,
  getCountryByCode,
  getRegionLabel,
  getStateOptions,
} from '@/data/international-locations';

type Props = {
  countryCode: string;
  region: string;
  regionCode: string;
  city: string;
  countryError?: string;
  regionError?: string;
  cityError?: string;
  onCountryChange: (country: {
    countryCode: string;
    countryName: string;
    phoneCode: string;
  }) => void;
  onRegionChange: (region: { region: string; regionCode: string }) => void;
  onCityChange: (city: string) => void;
};

export function InternationalLocationFields({
  countryCode,
  region,
  regionCode,
  city,
  countryError,
  regionError,
  cityError,
  onCountryChange,
  onRegionChange,
  onCityChange,
}: Props) {
  const selectedCountry = useMemo(() => getCountryByCode(countryCode), [countryCode]);
  const states = useMemo(() => getStateOptions(countryCode), [countryCode]);
  const cities = useMemo(
    () => getCityOptions(countryCode, regionCode),
    [countryCode, regionCode],
  );

  const regionLabel = getRegionLabel(countryCode);
  const cityLabel = getCityLabel(countryCode);
  const hasStateOptions = states.length > 0;
  const hasCityOptions = cities.length > 0;

  return (
    <>
      <div className="sm:col-span-2">
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
          País
        </label>
        <select
          value={selectedCountry.isoCode}
          onChange={(event) => {
            const nextCountry = getCountryByCode(event.target.value);
            onCountryChange({
              countryCode: nextCountry.isoCode,
              countryName: nextCountry.name,
              phoneCode: nextCountry.phonecode,
            });
          }}
          className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20 ${
            countryError ? 'border-red-300' : 'border-stone-200'
          }`}
        >
          {COUNTRY_OPTIONS.map((country) => (
            <option key={country.isoCode} value={country.isoCode}>
              {country.name}
            </option>
          ))}
        </select>
        {countryError && <p className="mt-2 text-xs text-red-500">{countryError}</p>}
      </div>

      <div>
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
          {regionLabel}
        </label>
        {hasStateOptions ? (
          <select
            value={regionCode}
            onChange={(event) => {
              const nextState = states.find((state) => state.isoCode === event.target.value);
              onRegionChange({
                region: nextState?.name ?? '',
                regionCode: nextState?.isoCode ?? '',
              });
            }}
            className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20 ${
              regionError ? 'border-red-300' : 'border-stone-200'
            }`}
          >
            <option value="">Selecciona una opción</option>
            {states.map((state) => (
              <option key={state.isoCode} value={state.isoCode}>
                {state.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={region}
            onChange={(event) =>
              onRegionChange({
                region: event.target.value,
                regionCode: '',
              })
            }
            placeholder={regionLabel}
            className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20 ${
              regionError ? 'border-red-300' : 'border-stone-200'
            }`}
          />
        )}
        {regionError ? (
          <p className="mt-2 text-xs text-red-500">{regionError}</p>
        ) : !hasStateOptions ? (
          <p className="mt-2 text-xs text-stone-400">
            Puedes escribir esta información manualmente.
          </p>
        ) : null}
      </div>

      <div>
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
          {cityLabel}
        </label>
        {hasCityOptions ? (
          <select
            value={city}
            onChange={(event) => onCityChange(event.target.value)}
            className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20 ${
              cityError ? 'border-red-300' : 'border-stone-200'
            }`}
          >
            <option value="">Selecciona una opción</option>
            {cities.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={city}
            onChange={(event) => onCityChange(event.target.value)}
            placeholder={cityLabel}
            className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20 ${
              cityError ? 'border-red-300' : 'border-stone-200'
            }`}
          />
        )}
        {cityError ? (
          <p className="mt-2 text-xs text-red-500">{cityError}</p>
        ) : !hasCityOptions ? (
          <p className="mt-2 text-xs text-stone-400">
            Si no aparece en la lista, puedes escribirla manualmente.
          </p>
        ) : null}
      </div>
    </>
  );
}
