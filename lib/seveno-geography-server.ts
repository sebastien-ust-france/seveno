import 'server-only';

import {
  getAllCitiesOfCountry,
  getCitiesOfState,
  getCountries,
  getStatesOfCountry,
  type IState,
} from '@countrystatecity/countries';
import {
  EMPTY_GEOGRAPHIC_LOCATION,
  SUPPORTED_EUROPEAN_COUNTRY_CODES,
  formatGeographicLocation,
  isSupportedEuropeanCountryCode,
  type GeographicLocation,
  type GeographicOption,
} from '@/lib/seveno-geography';

// Geographic data: @countrystatecity/countries, derived from
// dr5hn/countries-states-cities-database and licensed under ODbL-1.0.
const FRENCH_OVERSEAS_DEPARTMENT_NAMES: Record<string, string> = {
  '971': 'Guadeloupe',
  '972': 'Martinique',
  '973': 'Guyane',
  '974': 'La Réunion',
  '976': 'Mayotte',
};

const FRENCH_OVERSEAS_DATA_COUNTRY_CODES: Record<string, string> = {
  '971': 'GP',
  '972': 'MQ',
  '973': 'GF',
  '974': 'RE',
  '976': 'YT',
};

const collator = new Intl.Collator('fr', { sensitivity: 'base' });
const frenchRegionNames = new Intl.DisplayNames(['fr'], { type: 'region' });

export class SevenoGeographyError extends Error {
  code: string;

  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
function cleanText(value: unknown, maxLength = 180) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > maxLength) {
    throw new SevenoGeographyError('invalid_geographic_location', 400, 'La localisation est invalide.');
  }
  return text;
}

function normalizeCountryCode(value: unknown) {
  const countryCode = cleanText(value, 2).toUpperCase();
  if (!countryCode || !isSupportedEuropeanCountryCode(countryCode)) {
    throw new SevenoGeographyError('invalid_country', 400, 'Le pays sélectionné n’est pas pris en charge.');
  }
  return countryCode;
}

function toFrenchAdministrativeArea(state: IState): GeographicOption | null {
  if (state.type === 'metropolitan department') {
    return { code: state.iso2, name: state.name };
  }
  if (state.iso2 === '75C') {
    return { code: '75', name: 'Paris' };
  }
  if (state.iso2 in FRENCH_OVERSEAS_DEPARTMENT_NAMES) {
    return { code: state.iso2, name: FRENCH_OVERSEAS_DEPARTMENT_NAMES[state.iso2] };
  }
  return null;
}

function sourceAdministrativeAreaCode(countryCode: string, administrativeAreaCode: string) {
  if (countryCode === 'FR' && administrativeAreaCode === '75') return '75C';
  return administrativeAreaCode;
}

export async function listSupportedEuropeanCountries(): Promise<GeographicOption[]> {
  const countries = await getCountries();
  const availableCodes = new Set(countries.map((country) => country.iso2));
  const options = SUPPORTED_EUROPEAN_COUNTRY_CODES
    .filter((code) => availableCodes.has(code))
    .map((code) => ({ code, name: frenchRegionNames.of(code) ?? code }))
    .sort((left, right) => collator.compare(left.name, right.name));
  const france = options.find((option) => option.code === 'FR');
  return france ? [france, ...options.filter((option) => option.code !== 'FR')] : options;
}

export async function listAdministrativeAreas(countryCodeValue: unknown): Promise<GeographicOption[]> {
  const countryCode = normalizeCountryCode(countryCodeValue);
  const states = await getStatesOfCountry(countryCode);
  const options = countryCode === 'FR'
    ? states.map(toFrenchAdministrativeArea).filter((value): value is GeographicOption => Boolean(value))
    : states.map((state) => ({ code: state.iso2, name: state.name }));

  return options.sort((left, right) => collator.compare(left.name, right.name));
}

export async function listCities(
  countryCodeValue: unknown,
  administrativeAreaCodeValue: unknown,
): Promise<GeographicOption[]> {
  const countryCode = normalizeCountryCode(countryCodeValue);
  const administrativeAreaCode = cleanText(administrativeAreaCodeValue, 20);
  if (!administrativeAreaCode) {
    throw new SevenoGeographyError('administrative_area_required', 400, 'Sélectionnez une subdivision administrative.');
  }
  const areas = await listAdministrativeAreas(countryCode);
  if (!areas.some((area) => area.code === administrativeAreaCode)) {
    throw new SevenoGeographyError('invalid_administrative_area', 400, 'La subdivision ne correspond pas au pays.');
  }

  const overseasCountryCode = countryCode === 'FR'
    ? FRENCH_OVERSEAS_DATA_COUNTRY_CODES[administrativeAreaCode]
    : undefined;
  const sourceCode = sourceAdministrativeAreaCode(countryCode, administrativeAreaCode);
  const cities = overseasCountryCode
    ? await getAllCitiesOfCountry(overseasCountryCode)
    : await getCitiesOfState(countryCode, sourceCode);
  return cities
    .map((city) => ({ code: String(city.id), name: city.name }))
    .sort((left, right) => collator.compare(left.name, right.name));
}

export async function normalizeGeographicLocation(
  value: unknown,
  options: { allowEmpty?: boolean } = {},
): Promise<GeographicLocation> {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const rawCountryCode = cleanText(record.countryCode, 2);
  const rawAdministrativeAreaCode = cleanText(record.administrativeAreaCode, 20);
  const rawCity = cleanText(record.city, 40);

  if (!rawCountryCode) {
    if (rawAdministrativeAreaCode || rawCity || !options.allowEmpty) {
      throw new SevenoGeographyError('country_required', 400, 'Sélectionnez un pays.');
    }
    return { ...EMPTY_GEOGRAPHIC_LOCATION };
  }

  const countryCode = normalizeCountryCode(rawCountryCode);
  const countries = await listSupportedEuropeanCountries();
  const country = countries.find((option) => option.code === countryCode);
  if (!country) {
    throw new SevenoGeographyError('invalid_country', 400, 'Le pays sélectionné n’est pas pris en charge.');
  }

  if (!rawAdministrativeAreaCode) {
    if (rawCity) {
      throw new SevenoGeographyError('administrative_area_required', 400, 'Sélectionnez une subdivision avant la ville.');
    }
    return {
      countryCode,
      countryName: country.name,
      administrativeAreaCode: '',
      administrativeAreaName: '',
      city: '',
      cityName: '',
    };
  }

  const areas = await listAdministrativeAreas(countryCode);
  const area = areas.find((option) => option.code === rawAdministrativeAreaCode);
  if (!area) {
    throw new SevenoGeographyError('invalid_administrative_area', 400, 'La subdivision ne correspond pas au pays.');
  }

  if (!rawCity) {
    return {
      countryCode,
      countryName: country.name,
      administrativeAreaCode: area.code,
      administrativeAreaName: area.name,
      city: '',
      cityName: '',
    };
  }

  const cities = await listCities(countryCode, area.code);
  const city = cities.find((option) => option.code === rawCity);
  if (!city) {
    throw new SevenoGeographyError('invalid_city', 400, 'La ville ne correspond pas à la subdivision sélectionnée.');
  }

  return {
    countryCode,
    countryName: country.name,
    administrativeAreaCode: area.code,
    administrativeAreaName: area.name,
    city: city.code,
    cityName: city.name,
  };
}

export function geographicLocationStorageFields(location: GeographicLocation) {
  return {
    ...location,
    locationLabel: formatGeographicLocation(location),
  };
}
