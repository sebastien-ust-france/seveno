'use client';

import { useEffect, useState } from 'react';
import { Select } from '@/components/ui/Select';
import {
  selectGeographicAdministrativeArea,
  selectGeographicCountry,
  type GeographicLocation,
  type GeographicOption,
} from '@/lib/seveno-geography';

type GeographicLocationFieldsProps = {
  value: GeographicLocation;
  onChange: (value: GeographicLocation) => void;
  requiredCountry?: boolean;
  legacyLabel?: string;
};

async function loadOptions(params: URLSearchParams) {
  const response = await fetch(`/api/seveno/geography?${params.toString()}`);
  const payload = await response.json().catch(() => null) as { options?: GeographicOption[]; message?: string } | null;
  if (!response.ok) throw new Error(payload?.message ?? 'Le référentiel géographique est indisponible.');
  return Array.isArray(payload?.options) ? payload.options : [];
}
export function GeographicLocationFields({
  value,
  onChange,
  requiredCountry = false,
  legacyLabel = '',
}: GeographicLocationFieldsProps) {
  const [countries, setCountries] = useState<GeographicOption[]>([]);
  const [administrativeAreas, setAdministrativeAreas] = useState<GeographicOption[]>([]);
  const [cities, setCities] = useState<GeographicOption[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingCountries(true);
    loadOptions(new URLSearchParams({ level: 'countries' }))
      .then((options) => { if (active) setCountries(options); })
      .catch((thrownError) => { if (active) setError(thrownError instanceof Error ? thrownError.message : 'Référentiel indisponible.'); })
      .finally(() => { if (active) setLoadingCountries(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!value.countryCode) {
      setAdministrativeAreas([]);
      setLoadingAreas(false);
      return () => { active = false; };
    }
    setLoadingAreas(true);
    setError(null);
    loadOptions(new URLSearchParams({ level: 'administrativeAreas', countryCode: value.countryCode }))
      .then((options) => { if (active) setAdministrativeAreas(options); })
      .catch((thrownError) => { if (active) setError(thrownError instanceof Error ? thrownError.message : 'Subdivisions indisponibles.'); })
      .finally(() => { if (active) setLoadingAreas(false); });
    return () => { active = false; };
  }, [value.countryCode]);

  useEffect(() => {
    let active = true;
    if (!value.countryCode || !value.administrativeAreaCode) {
      setCities([]);
      setLoadingCities(false);
      return () => { active = false; };
    }
    setLoadingCities(true);
    setError(null);
    loadOptions(new URLSearchParams({
      level: 'cities',
      countryCode: value.countryCode,
      administrativeAreaCode: value.administrativeAreaCode,
    }))
      .then((options) => { if (active) setCities(options); })
      .catch((thrownError) => { if (active) setError(thrownError instanceof Error ? thrownError.message : 'Villes indisponibles.'); })
      .finally(() => { if (active) setLoadingCities(false); });
    return () => { active = false; };
  }, [value.countryCode, value.administrativeAreaCode]);

  function changeCountry(countryCode: string) {
    const country = countries.find((option) => option.code === countryCode);
    onChange(selectGeographicCountry(countryCode, country?.name ?? ''));
  }

  function changeAdministrativeArea(administrativeAreaCode: string) {
    const area = administrativeAreas.find((option) => option.code === administrativeAreaCode);
    onChange(selectGeographicAdministrativeArea(value, administrativeAreaCode, area?.name ?? ''));
  }

  function changeCity(city: string) {
    const selectedCity = cities.find((option) => option.code === city);
    onChange({ ...value, city, cityName: selectedCity?.name ?? '' });
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <label className="space-y-2 text-sm text-slate-200">
        <span className="font-medium text-white">Pays{requiredCountry ? ' *' : ''}</span>
        <Select value={value.countryCode} onChange={(event) => changeCountry(event.target.value)} required={requiredCountry} disabled={loadingCountries}>
          <option value="">{loadingCountries ? 'Chargement des pays…' : 'Sélectionner un pays'}</option>
          {countries.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
        </Select>
      </label>

      <label className="space-y-2 text-sm text-slate-200">
        <span className="font-medium text-white">{value.countryCode === 'FR' ? 'Département' : 'Département / région'}</span>
        <Select value={value.administrativeAreaCode} onChange={(event) => changeAdministrativeArea(event.target.value)} disabled={!value.countryCode || loadingAreas}>
          <option value="">{loadingAreas ? 'Chargement…' : 'Tout le pays'}</option>
          {administrativeAreas.map((option) => <option key={option.code} value={option.code}>{option.code} — {option.name}</option>)}
        </Select>
      </label>

      <label className="space-y-2 text-sm text-slate-200">
        <span className="font-medium text-white">Ville</span>
        <Select value={value.city} onChange={(event) => changeCity(event.target.value)} disabled={!value.countryCode || !value.administrativeAreaCode || loadingCities}>
          <option value="">{loadingCities ? 'Chargement…' : 'Toute la subdivision'}</option>
          {cities.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
        </Select>
      </label>

      {legacyLabel && !value.countryCode ? (
        <p className="text-xs leading-5 text-amber-200 md:col-span-3">
          Ancienne localisation conservée : {legacyLabel}. Sélectionnez une localisation structurée pour la remplacer.
        </p>
      ) : null}
      {error ? <p className="text-xs text-rose-300 md:col-span-3">{error}</p> : null}
    </div>
  );
}
