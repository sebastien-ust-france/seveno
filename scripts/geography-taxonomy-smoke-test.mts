import assert from 'node:assert/strict';
import { JOB_SECTORS } from '@/lib/job-taxonomy';
import {
  matchesGeographicHierarchy,
  selectGeographicAdministrativeArea,
  selectGeographicCountry,
  type GeographicLocation,
} from '@/lib/seveno-geography';
import {
  listAdministrativeAreas,
  listCities,
  listSupportedEuropeanCountries,
  normalizeGeographicLocation,
} from '@/lib/seveno-geography-server';
import { normalizeCandidateProfileUpsertInput } from '@/lib/seveno-candidate-profile-server';
import { validateJobOfferInput } from '@/lib/seveno-job-offers-server';

const AIDE_A_DOMICILE_ID = 'sante-medical-paramedical-medico-social-aide-a-domicile';
const matchingRoles = JOB_SECTORS.flatMap((sector) => sector.families.flatMap((family) => (
  family.roles
    .filter((role) => role.code === AIDE_A_DOMICILE_ID || role.label === 'Aide à domicile')
    .map((role) => ({ sector, family, role }))
)));
assert.equal(matchingRoles.length, 1);
assert.equal(matchingRoles[0]?.sector.code, 'sante-medical-paramedical');
assert.equal(matchingRoles[0]?.family.code, 'sante-medical-paramedical-medico-social');
assert.equal(matchingRoles[0]?.role.label, 'Aide à domicile');

const candidateInput = normalizeCandidateProfileUpsertInput({
  targetJobRoleIds: [AIDE_A_DOMICILE_ID],
  desiredContractTypeCodes: ['CDI'],
  availability: 'immediate',
  locationArea: 'France',
  countryCode: 'FR',
  experienceLevel: 'intermediate',
  profileStatus: 'draft',
  anonymousVisibilityConsent: false,
});
assert.deepEqual(candidateInput.targetJobRoleIds, [AIDE_A_DOMICILE_ID]);

const offerInput = validateJobOfferInput({
  title: 'Aide à domicile',
  sectorId: matchingRoles[0]?.sector.code,
  jobFamilyId: matchingRoles[0]?.family.code,
  jobRoleId: AIDE_A_DOMICILE_ID,
  location: 'France',
  countryCode: 'FR',
  workMode: 'onsite',
  contractType: 'permanent',
  workingTime: 'full_time',
  description: 'Accompagnement au domicile des bénéficiaires.',
  missions: 'Aide dans les activités quotidiennes.',
  profileSummary: 'Sens du service et autonomie.',
  questionnaireRequired: false,
  questionnaireId: '',
  requiredPrerequisites: [],
  preferredPrerequisites: [],
});
assert.equal(offerInput.jobRoleId, AIDE_A_DOMICILE_ID);
assert.equal(offerInput.jobRoleLabel, 'Aide à domicile');

const countries = await listSupportedEuropeanCountries();
assert.equal(countries[0]?.code, 'FR');
assert.equal(countries[0]?.name, 'France');
const otherCountryNames = countries.slice(1).map((country) => country.name);
assert.deepEqual(otherCountryNames, [...otherCountryNames].sort((left, right) => left.localeCompare(right, 'fr', { sensitivity: 'base' })));

const frenchAreas = await listAdministrativeAreas('FR');
assert.deepEqual(frenchAreas.find((area) => area.code === '33'), { code: '33', name: 'Gironde' });
assert.deepEqual(frenchAreas.find((area) => area.code === '55'), { code: '55', name: 'Meuse' });
assert.equal(frenchAreas.length, 101);

const girondeCities = await listCities('FR', '33');
const bordeaux = girondeCities.find((city) => city.name === 'Bordeaux');
assert.ok(bordeaux);
const meuseCities = await listCities('FR', '55');
const verdun = meuseCities.find((city) => city.name === 'Verdun');
assert.ok(verdun);
assert.ok((await listCities('FR', '973')).some((city) => city.name === 'Cayenne'));

const bordeauxLocation = await normalizeGeographicLocation({
  countryCode: 'FR',
  administrativeAreaCode: '33',
  city: bordeaux.code,
});
const verdunLocation = await normalizeGeographicLocation({
  countryCode: 'FR',
  administrativeAreaCode: '55',
  city: verdun.code,
});
assert.equal(bordeauxLocation.cityName, 'Bordeaux');
assert.equal(verdunLocation.cityName, 'Verdun');

assert.equal(matchesGeographicHierarchy(bordeauxLocation, { countryCode: 'FR' }), true);
assert.equal(matchesGeographicHierarchy(verdunLocation, { countryCode: 'FR' }), true);
assert.equal(matchesGeographicHierarchy(verdunLocation, { countryCode: 'FR', administrativeAreaCode: '55' }), true);
assert.equal(matchesGeographicHierarchy(bordeauxLocation, { countryCode: 'FR', administrativeAreaCode: '55' }), false);
assert.equal(matchesGeographicHierarchy(verdunLocation, {
  countryCode: 'FR',
  administrativeAreaCode: '55',
  city: verdun.code,
}), true);
assert.equal(matchesGeographicHierarchy({ ...verdunLocation, city: bordeaux.code }, {
  countryCode: 'FR',
  administrativeAreaCode: '55',
  city: verdun.code,
}), false);

const changedCountry = selectGeographicCountry('BE', 'Belgique');
assert.deepEqual(changedCountry, {
  countryCode: 'BE',
  countryName: 'Belgique',
  administrativeAreaCode: '',
  administrativeAreaName: '',
  city: '',
  cityName: '',
});
const changedArea = selectGeographicAdministrativeArea(
  verdunLocation as GeographicLocation,
  '33',
  'Gironde',
);
assert.equal(changedArea.city, '');
assert.equal(changedArea.cityName, '');

console.log('geography-taxonomy-smoke-test: ok');
