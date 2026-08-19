'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import AnonymousCandidateCard from '@/components/entreprise/AnonymousCandidateCard';
import { GeographicLocationFields } from '@/components/ui/GeographicLocationFields';
import { Select } from '@/components/ui/Select';
import { getCurrentAuthUser } from '@/lib/auth';
import { JOB_SECTORS, findSectorLabel, getFamiliesBySector, getRolesByFamily } from '@/lib/job-taxonomy';
import { getCompanyProfile } from '@/lib/seveno-companies';
import {
  buildCandidateSearchParams,
  searchVisibleCandidateProfiles,
} from '@/lib/seveno-company-candidates';
import { ensureSevenoUser, hasSevenoTermsAcceptance, resolveSevenoRedirect } from '@/lib/seveno-users';
import type {
  CandidateAvailability,
  CandidateExperienceLevel,
  CandidateSearchFilters,
  CompanyProfile,
  CompanyProfileStatus,
  CompanySize,
  CompanyVerificationStatus,
  SevenoUser,
  VisibleCandidateProfile,
} from '@/types/seveno';
import type { User } from 'firebase/auth';
import {
  EMPTY_GEOGRAPHIC_LOCATION,
  type GeographicLocation,
} from '@/lib/seveno-geography';

const PROFILE_STATUS_LABELS: Record<CompanyProfileStatus, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  suspended: 'Suspendu',
};

const VERIFICATION_STATUS_LABELS: Record<CompanyVerificationStatus, string> = {
  unverified: 'Non vérifiée',
  pending: 'En attente',
  verified: 'Vérifiée',
  rejected: 'Refusée',
};

const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  solo: 'Solo',
  '1_9': '1 a 9',
  '10_49': '10 a 49',
  '50_249': '50 a 249',
  '250_plus': '250 et plus',
};

const AVAILABILITY_OPTIONS: Array<{ value: CandidateAvailability; label: string }> = [
  { value: 'immediate', label: 'Immédiatement' },
  { value: 'less_than_1_month', label: 'Moins d’un mois' },
  { value: 'one_to_three_months', label: 'Sous 1 à 3 mois' },
  { value: 'listening', label: 'En écoute' },
  { value: 'not_available', label: 'Non disponible' },
];

const EXPERIENCE_OPTIONS: Array<{ value: CandidateExperienceLevel; label: string }> = [
  { value: 'beginner', label: 'Débutant' },
  { value: 'intermediate', label: 'Intermédiaire' },
  { value: 'confirmed', label: 'Confirmé' },
  { value: 'senior', label: 'Senior' },
  { value: 'expert', label: 'Expert' },
];

function parseCandidateSearchFilters(params: URLSearchParams): CandidateSearchFilters | null {
  const sectorId = params.get('sectorId')?.trim() ?? '';
  const jobFamilyId = params.get('jobFamilyId')?.trim() ?? '';
  const jobRoleId = params.get('jobRoleId')?.trim() ?? '';
  const sector = JOB_SECTORS.find((item) => item.code === sectorId);
  const family = sector?.families.find((item) => item.code === jobFamilyId);
  const role = family?.roles.find((item) => item.code === jobRoleId);
  if (!sector || !family || !role) {
    return null;
  }

  const locationArea = params.get('locationArea')?.trim() ?? '';
  const countryCode = params.get('countryCode')?.trim() ?? '';
  const administrativeAreaCode = params.get('administrativeAreaCode')?.trim() ?? '';
  const city = params.get('city')?.trim() ?? '';
  const availabilityValue = params.get('availability')?.trim() ?? '';
  const experienceValue = params.get('experienceLevel')?.trim() ?? '';
  const availability = AVAILABILITY_OPTIONS.some((option) => option.value === availabilityValue)
    ? (availabilityValue as CandidateAvailability)
    : undefined;
  const experienceLevel = EXPERIENCE_OPTIONS.some((option) => option.value === experienceValue)
    ? (experienceValue as CandidateExperienceLevel)
    : undefined;

  return {
    sectorId,
    jobFamilyId,
    jobRoleId,
    ...(locationArea ? { locationArea } : {}),
    ...(countryCode ? { countryCode } : {}),
    ...(administrativeAreaCode ? { administrativeAreaCode } : {}),
    ...(city ? { city } : {}),
    ...(availability ? { availability } : {}),
    ...(experienceLevel ? { experienceLevel } : {}),
  };
}

function profileTone(value: CompanyProfileStatus) {
  switch (value) {
    case 'active':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100';
    case 'suspended':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-100';
    case 'draft':
    default:
      return 'border-amber-400/20 bg-amber-400/10 text-amber-100';
  }
}

function verificationTone(value: CompanyVerificationStatus) {
  switch (value) {
    case 'verified':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100';
    case 'rejected':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-100';
    case 'pending':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-100';
    case 'unverified':
    default:
      return 'border-sky-400/20 bg-sky-400/10 text-sky-100';
  }
}

function isIncompleteCompanyProfile(profile: CompanyProfile) {
  return (
    profile.companyName.trim().length === 0
    || profile.companyType.trim().length === 0
    || profile.businessSector.trim().length === 0
    || profile.headquartersArea.trim().length === 0
    || profile.contactRole.trim().length === 0
    || profile.recruitmentAreas.length === 0
  );
}

export default function CompanyDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [user, setUser] = useState<SevenoUser | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [candidateProfiles, setCandidateProfiles] = useState<VisibleCandidateProfile[]>([]);
  const [searchStarted, setSearchStarted] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeSearchFilters, setActiveSearchFilters] = useState<CandidateSearchFilters | null>(null);
  const [activeSearchHref, setActiveSearchHref] = useState('/entreprise');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [sectorId, setSectorId] = useState('');
  const [jobFamilyId, setJobFamilyId] = useState('');
  const [jobRoleId, setJobRoleId] = useState('');
  const [geographicLocation, setGeographicLocation] = useState<GeographicLocation>({ ...EMPTY_GEOGRAPHIC_LOCATION });
  const [availability, setAvailability] = useState<CandidateAvailability | ''>('');
  const [experienceLevel, setExperienceLevel] = useState<CandidateExperienceLevel | ''>('');
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCompanyDashboard() {
      try {
        const authUser = await getCurrentAuthUser();
        if (!active) {
          return;
        }

        if (!authUser) {
          router.replace('/connexion');
          return;
        }

        const sevenoUser = await ensureSevenoUser(authUser);
        if (!active) {
          return;
        }

        if (!sevenoUser.role) {
          router.replace('/onboarding');
          return;
        }

        if (sevenoUser.role !== 'company') {
          router.replace(resolveSevenoRedirect(sevenoUser));
          return;
        }

        if (sevenoUser.onboardingCompleted && !hasSevenoTermsAcceptance(sevenoUser, 'company_first_access')) {
          router.replace('/cgu');
          return;
        }

        const companyProfile = await getCompanyProfile(sevenoUser.uid);
        if (!active) {
          return;
        }

        if (!companyProfile) {
          router.replace('/entreprise/onboarding');
          return;
        }

        setUser(sevenoUser);
        setProfile(companyProfile);
        setAuthUser(authUser);

        if (companyProfile.profileStatus === 'suspended' || isIncompleteCompanyProfile(companyProfile)) {
          setCandidateProfiles([]);
          setLoading(false);
          return;
        }

        const restoredFilters = parseCandidateSearchFilters(new URLSearchParams(window.location.search));
        if (restoredFilters) {
          setSectorId(restoredFilters.sectorId);
          setJobFamilyId(restoredFilters.jobFamilyId);
          setJobRoleId(restoredFilters.jobRoleId);
          setGeographicLocation({
            ...EMPTY_GEOGRAPHIC_LOCATION,
            countryCode: restoredFilters.countryCode ?? '',
            administrativeAreaCode: restoredFilters.administrativeAreaCode ?? '',
            city: restoredFilters.city ?? '',
          });
          setAvailability(restoredFilters.availability ?? '');
          setExperienceLevel(restoredFilters.experienceLevel ?? '');
          setSearchStarted(true);
          setSearchLoading(true);
          setActiveSearchFilters(restoredFilters);
          setActiveSearchHref(`/entreprise?${buildCandidateSearchParams(restoredFilters).toString()}`);

          try {
            const result = await searchVisibleCandidateProfiles(authUser, restoredFilters);
            if (!active) return;
            setCandidateProfiles(result.candidates);
            setNextCursor(result.nextCursor);
            setCandidateError(null);
          } catch (thrownError) {
            if (!active) return;
            setCandidateProfiles([]);
            setNextCursor(null);
            setCandidateError(
              thrownError instanceof Error ? thrownError.message : 'La recherche de profils a échoué.',
            );
          } finally {
            if (active) setSearchLoading(false);
          }
        }

        setLoading(false);
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : 'L’espace entreprise n’a pas pu être chargé.');
        setLoading(false);
      }
    }

    void loadCompanyDashboard();

    return () => {
      active = false;
    };
  }, [router]);

  const selectedSector = JOB_SECTORS.find((item) => item.code === sectorId) ?? null;
  const familyOptions = getFamiliesBySector(selectedSector?.code ?? '');
  const selectedFamily = familyOptions.find((item) => item.code === jobFamilyId) ?? null;
  const roleOptions = getRolesByFamily(selectedFamily?.code ?? '');
  const hasSelectedJobRole = roleOptions.some((role) => role.code === jobRoleId);

  async function executeSearch(filters: CandidateSearchFilters, cursor: string | null = null) {
    const firebaseUser = authUser ?? (await getCurrentAuthUser());
    if (!firebaseUser) {
      router.replace('/connexion');
      return null;
    }

    setSearchLoading(true);
    setCandidateError(null);
    try {
      return await searchVisibleCandidateProfiles(firebaseUser, filters, cursor);
    } catch (thrownError) {
      setCandidateError(thrownError instanceof Error ? thrownError.message : 'La recherche de profils a échoué.');
      return null;
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleCandidateSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchStarted(true);

    if (!selectedSector || !selectedFamily || !hasSelectedJobRole) {
      setCandidateProfiles([]);
      setCandidateError('Sélectionnez un secteur, une famille et un métier précis pour lancer la recherche.');
      return;
    }

    const filters: CandidateSearchFilters = {
      sectorId: selectedSector.code,
      jobFamilyId: selectedFamily.code,
      jobRoleId,
      ...(geographicLocation.countryCode ? { countryCode: geographicLocation.countryCode } : {}),
      ...(geographicLocation.administrativeAreaCode
        ? { administrativeAreaCode: geographicLocation.administrativeAreaCode }
        : {}),
      ...(geographicLocation.city ? { city: geographicLocation.city } : {}),
      ...(availability ? { availability } : {}),
      ...(experienceLevel ? { experienceLevel } : {}),
    };
    const searchHref = `/entreprise?${buildCandidateSearchParams(filters).toString()}`;
    window.history.replaceState(null, '', searchHref);
    setActiveSearchHref(searchHref);
    setActiveSearchFilters(filters);

    const result = await executeSearch(filters);
    if (!result) return;
    setCandidateProfiles(result.candidates);
    setNextCursor(result.nextCursor);
    setCursorHistory([null]);
    setPageIndex(0);
  }

  async function handleNextPage() {
    if (!activeSearchFilters || !nextCursor) return;
    const result = await executeSearch(activeSearchFilters, nextCursor);
    if (!result) return;
    setCursorHistory((current) => [...current.slice(0, pageIndex + 1), nextCursor]);
    setPageIndex((current) => current + 1);
    setCandidateProfiles(result.candidates);
    setNextCursor(result.nextCursor);
  }

  async function handlePreviousPage() {
    if (!activeSearchFilters || pageIndex <= 0) return;
    const previousCursor = cursorHistory[pageIndex - 1] ?? null;
    const result = await executeSearch(activeSearchFilters, previousCursor);
    if (!result) return;
    setPageIndex((current) => Math.max(0, current - 1));
    setCandidateProfiles(result.candidates);
    setNextCursor(result.nextCursor);
  }

  const businessSectorLabel = profile ? findSectorLabel(profile.businessSector) ?? 'Secteur non renseigné' : null;
  const recruitmentAreas = profile?.recruitmentAreas ?? [];
  const companyIsSuspended = profile?.profileStatus === 'suspended';
  const companyIsIncomplete = profile ? isIncompleteCompanyProfile(profile) : false;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.16),transparent_30%),linear-gradient(180deg,#020617_0%,#020817_45%,#020617_100%)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[86.4rem] items-center justify-center px-5 py-10 sm:px-8">
        <section className="w-full max-w-[86.4rem] rounded-[32px] border border-violet-400/10 bg-[linear-gradient(180deg,rgba(12,14,34,0.96),rgba(8,15,28,0.94))] p-6 shadow-[0_24px_90px_rgba(2,6,23,0.42)] backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-200/80">Espace entreprise</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">Votre profil entreprise</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                Cet espace ne contient que les informations publiques de l’entreprise. Les profils candidats affichés
                ici restent anonymes et limités aux compétences vérifiées.
              </p>
            </div>

          </div>

          {loading ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
              Chargement du profil entreprise...
            </div>
          ) : (
            <div className="mt-8 space-y-8">
              <div className="flex flex-wrap gap-3">
                <Link href="/entreprise/offres/nouvelle" className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:brightness-110">
                  Créer une offre
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <article className="rounded-[24px] border border-violet-400/12 bg-[linear-gradient(180deg,rgba(12,14,34,0.94),rgba(8,15,28,0.88))] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200/80">Nom commercial</p>
                  <p className="mt-3 text-lg font-semibold text-white">{profile?.companyName ?? 'Non disponible'}</p>
                </article>

                <article className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Type d’entreprise</p>
                  <p className="mt-3 text-lg font-semibold text-white">{profile?.companyType ?? 'Non disponible'}</p>
                </article>

                <article className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Secteur</p>
                  <p className="mt-3 text-lg font-semibold text-white">{businessSectorLabel ?? 'Non disponible'}</p>
                </article>

                <article className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Taille</p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {profile ? COMPANY_SIZE_LABELS[profile.companySize] ?? profile.companySize : 'Non disponible'}
                  </p>
                </article>

                <article className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Siege</p>
                  <p className="mt-3 text-lg font-semibold text-white">{profile?.headquartersArea ?? 'Non disponible'}</p>
                </article>

                <article className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Fonction contact</p>
                  <p className="mt-3 text-lg font-semibold text-white">{profile?.contactRole ?? 'Non disponible'}</p>
                </article>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-[24px] border border-violet-400/12 bg-white/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200/80">
                    Zones de recrutement
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {recruitmentAreas.length > 0 ? (
                      recruitmentAreas.map((area) => (
                        <span
                          key={area}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200"
                        >
                          {area}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">Non renseignées</span>
                    )}
                  </div>
                </article>

                <article className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Statuts</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <span
                      className={
                        'rounded-full border px-3 py-1 text-sm font-medium ' +
                        profileTone(profile?.profileStatus ?? 'draft')
                      }
                    >
                      {PROFILE_STATUS_LABELS[profile?.profileStatus ?? 'draft']}
                    </span>
                    <span
                      className={
                        'rounded-full border px-3 py-1 text-sm font-medium ' +
                        verificationTone(profile?.verificationStatus ?? 'unverified')
                      }
                    >
                      {VERIFICATION_STATUS_LABELS[profile?.verificationStatus ?? 'unverified']}
                    </span>
                  </div>
                </article>
              </div>

              <section className="relative overflow-hidden rounded-[32px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.96),rgba(8,15,28,0.92))] px-5 py-6 shadow-[0_24px_80px_rgba(2,6,23,0.34)] backdrop-blur sm:px-6 sm:py-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.12),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.08),transparent_28%)]" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />

                <div className="relative">
                  <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-200/90">
                    Recherche de candidats
                  </p>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    Rechercher des profils anonymes
                  </h2>
                  <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
                    Sélectionnez un métier et vos principaux critères pour consulter les profils anonymes
                    correspondants. Aucune donnée d’identité n’est transmise.
                  </p>

                  {companyIsSuspended ? (
                    <div className="mt-7 rounded-[22px] border border-rose-400/15 bg-[linear-gradient(180deg,rgba(18,15,24,0.96),rgba(8,15,28,0.92))] p-5 text-sm leading-7 text-rose-100">
                      Votre accès entreprise est suspendu. Les profils anonymes ne sont pas affichés tant que le
                      statut n’a pas été réactivé.
                    </div>
                  ) : companyIsIncomplete ? (
                    <div className="mt-7 rounded-[22px] border border-amber-400/15 bg-[linear-gradient(180deg,rgba(18,15,24,0.96),rgba(8,15,28,0.92))] p-5 text-sm leading-7 text-amber-100">
                      Votre profil entreprise est incomplet. Complétez les informations requises pour consulter les
                      profils anonymes.
                      <div className="mt-4">
                        <Link
                          href="/entreprise/onboarding"
                          className="inline-flex rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-100 transition hover:border-amber-300/30 hover:bg-amber-400/15"
                        >
                           Compléter mon entreprise
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <>
                      <form
                        onSubmit={(event) => void handleCandidateSearch(event)}
                        className="mt-7 rounded-[24px] border border-white/10 bg-white/[0.04] p-5 sm:p-6"
                      >
                        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                          <label className="space-y-2 text-sm text-slate-200">
                            <span className="font-medium text-white">Secteur *</span>
                            <Select
                              value={sectorId}
                              onChange={(event) => {
                                setSectorId(event.target.value);
                                setJobFamilyId('');
                                setJobRoleId('');
                              }}
                              required
                            >
                              <option value="">Sélectionner un secteur</option>
                              {JOB_SECTORS.map((sector) => (
                                <option key={sector.code} value={sector.code}>
                                  {sector.label}
                                </option>
                              ))}
                            </Select>
                          </label>

                          <label className="space-y-2 text-sm text-slate-200">
                            <span className="font-medium text-white">Famille métier *</span>
                            <Select
                              value={jobFamilyId}
                              onChange={(event) => {
                                setJobFamilyId(event.target.value);
                                setJobRoleId('');
                              }}
                              required
                              disabled={!selectedSector}
                            >
                              <option value="">Sélectionner une famille métier</option>
                              {familyOptions.map((family) => (
                                <option key={family.code} value={family.code}>
                                  {family.label}
                                </option>
                              ))}
                            </Select>
                          </label>

                          <label className="space-y-2 text-sm text-slate-200">
                            <span className="font-medium text-white">Métier précis *</span>
                            <Select
                              value={jobRoleId}
                              onChange={(event) => setJobRoleId(event.target.value)}
                              required
                              disabled={!selectedFamily}
                            >
                              <option value="">Sélectionner un métier</option>
                              {roleOptions.map((role) => (
                                <option key={role.code} value={role.code}>
                                  {role.label}
                                </option>
                              ))}
                            </Select>
                          </label>

                          <div className="md:col-span-2 xl:col-span-3">
                            <p className="mb-3 text-sm font-medium text-white">Localisation</p>
                            <GeographicLocationFields
                              value={geographicLocation}
                              onChange={setGeographicLocation}
                            />
                          </div>

                          <label className="space-y-2 text-sm text-slate-200">
                            <span className="font-medium text-white">Disponibilité</span>
                            <Select
                              value={availability}
                              onChange={(event) => setAvailability(event.target.value as CandidateAvailability | '')}
                            >
                              <option value="">Toutes les disponibilités</option>
                              {AVAILABILITY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                          </label>

                          <label className="space-y-2 text-sm text-slate-200">
                            <span className="font-medium text-white">Niveau d’expérience</span>
                            <Select
                              value={experienceLevel}
                              onChange={(event) =>
                                setExperienceLevel(event.target.value as CandidateExperienceLevel | '')
                              }
                            >
                              <option value="">Tous les niveaux</option>
                              {EXPERIENCE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                          </label>

                        </div>

                        <div className="mt-6 flex flex-wrap items-center gap-3">
                          <button
                            type="submit"
                            disabled={searchLoading || !hasSelectedJobRole}
                            className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {searchLoading ? 'Recherche...' : 'Lancer la recherche'}
                          </button>
                          <p className="text-xs leading-6 text-slate-400">Le métier précis est obligatoire.</p>
                        </div>
                      </form>

                      {candidateError ? (
                        <div className="mt-6 rounded-[22px] border border-rose-400/15 bg-[linear-gradient(180deg,rgba(18,15,24,0.96),rgba(8,15,28,0.92))] p-5 text-sm leading-7 text-rose-100">
                          {candidateError}
                        </div>
                      ) : searchLoading ? (
                        <div className="mt-6 rounded-[22px] border border-cyan-400/12 bg-white/[0.04] p-5 text-sm text-slate-300">
                          Recherche des profils correspondants...
                        </div>
                      ) : !searchStarted ? (
                        <div className="mt-6 rounded-[22px] border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(9,17,32,0.95),rgba(8,15,28,0.9))] p-5 shadow-[0_18px_60px_rgba(2,6,23,0.22)]">
                          <p className="text-base font-semibold text-white">Rechercher des profils anonymes</p>
                          <p className="mt-2 text-sm leading-7 text-slate-300">
                            Sélectionnez un métier et vos principaux critères pour consulter les profils anonymes
                            correspondants.
                          </p>
                        </div>
                      ) : candidateProfiles.length === 0 ? (
                        <div className="mt-6 rounded-[22px] border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(9,17,32,0.95),rgba(8,15,28,0.9))] p-5 shadow-[0_18px_60px_rgba(2,6,23,0.22)]">
                          <p className="text-base font-semibold text-white">
                            Aucun profil ne correspond actuellement à ces critères.
                          </p>
                          <p className="mt-2 text-sm leading-7 text-slate-300">
                            Modifiez ou elargissez les filtres ci-dessus pour relancer la recherche.
                          </p>
                        </div>
                      ) : (
                        <>
                          <p className="mt-6 text-sm leading-7 text-slate-200">
                            {candidateProfiles.length}{' '}
                            {candidateProfiles.length > 1 ? 'résultats affichés' : 'résultat affiché'} sur cette page.
                          </p>
                          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {candidateProfiles.map((candidate) => (
                              <AnonymousCandidateCard
                                key={candidate.publicCandidateId}
                                profile={candidate}
                                returnHref={activeSearchHref}
                              />
                            ))}
                          </div>
                          <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
                            <p className="text-sm text-slate-400">Page {pageIndex + 1}</p>
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => void handlePreviousPage()}
                                disabled={pageIndex === 0 || searchLoading}
                                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Page précédente
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleNextPage()}
                                disabled={!nextCursor || searchLoading}
                                className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Page suivante
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </section>

              <div className="rounded-[24px] border border-violet-400/10 bg-[linear-gradient(180deg,rgba(12,14,34,0.9),rgba(8,15,28,0.86))] p-5 text-sm leading-7 text-slate-300">
                <p className="font-medium text-white">Prochaine étape</p>
                <p className="mt-3">
                  La mise en relation explicite viendra ensuite. Pour le moment, vous consultez uniquement des profils
                  anonymes, sans aucune donnée privée exposée.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/entreprise/offres/nouvelle"
                  className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  Créer une offre
                </Link>
              </div>

              {profile ? (
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Session: {user?.uid ?? profile.uid}</p>
              ) : null}
            </div>
          )}

          {error ? (
            <p className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
