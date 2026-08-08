import { City, Country, State } from 'country-state-city';

type CountryOption = {
  isoCode: string;
  name: string;
  phonecode: string;
};

type StateOption = {
  isoCode: string;
  name: string;
  countryCode: string;
};

type CityOption = {
  name: string;
  countryCode: string;
  stateCode?: string;
};

export const COUNTRY_OPTIONS: CountryOption[] = Country.getAllCountries()
  .map((country) => ({
    isoCode: country.isoCode,
    name: country.name,
    phonecode: country.phonecode,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'es'));

export const DEFAULT_COUNTRY =
  COUNTRY_OPTIONS.find((country) => country.isoCode === 'CO') ??
  COUNTRY_OPTIONS[0] ?? {
    isoCode: 'CO',
    name: 'Colombia',
    phonecode: '57',
  };

const PHONE_CODES_DESC = [...COUNTRY_OPTIONS]
  .map((country) => country.phonecode)
  .filter(Boolean)
  .sort((a, b) => b.length - a.length);

export function getCountryByCode(countryCode: string) {
  return COUNTRY_OPTIONS.find((country) => country.isoCode === countryCode) ?? DEFAULT_COUNTRY;
}

export function getStateOptions(countryCode: string): StateOption[] {
  if (!countryCode) return [];

  return State.getStatesOfCountry(countryCode).map((state) => ({
    isoCode: state.isoCode,
    name: state.name,
    countryCode: state.countryCode,
  }));
}

export function getCityOptions(countryCode: string, stateCode: string): CityOption[] {
  if (!countryCode || !stateCode) return [];

  return City.getCitiesOfState(countryCode, stateCode).map((city) => ({
    name: city.name,
    countryCode: city.countryCode,
    stateCode: city.stateCode,
  }));
}

export function getRegionLabel(countryCode: string) {
  if (countryCode === 'CO') return 'Departamento';
  if (countryCode === 'US') return 'Estado';
  return 'Región / Estado / Provincia';
}

export function getCityLabel(countryCode: string) {
  if (countryCode === 'CO') return 'Municipio / Ciudad';
  return 'Ciudad';
}

export function buildFullPhone(phoneCode: string, phoneNumber: string) {
  const normalizedCode = phoneCode.replace(/\D/g, '');
  const normalizedNumber = phoneNumber.trim().replace(/\s+/g, ' ');

  if (!normalizedCode && !normalizedNumber) return '';
  if (!normalizedCode) return normalizedNumber;
  if (!normalizedNumber) return `+${normalizedCode}`;

  return `+${normalizedCode} ${normalizedNumber}`;
}

export function extractPhoneParts(
  rawPhone: string | null | undefined,
  fallbackPhoneCode = DEFAULT_COUNTRY.phonecode,
) {
  const source = (rawPhone ?? '').trim();
  if (!source) {
    return {
      phoneCode: fallbackPhoneCode,
      phoneNumber: '',
    };
  }

  const digitsOnly = source.replace(/\D/g, '');

  for (const phoneCode of PHONE_CODES_DESC) {
    if (digitsOnly.startsWith(phoneCode)) {
      const localDigits = digitsOnly.slice(phoneCode.length).trim();
      return {
        phoneCode,
        phoneNumber:
          localDigits || source.replace(new RegExp(`^\\+?${phoneCode}\\s*`), '').trim(),
      };
    }
  }

  return {
    phoneCode: fallbackPhoneCode,
    phoneNumber: source.replace(/^\+\d+\s*/, '').trim() || source,
  };
}
