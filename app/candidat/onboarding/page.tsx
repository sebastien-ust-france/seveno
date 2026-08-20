'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentAuthUser } from '@/lib/auth';
import { JOB_SECTORS } from '@/lib/job-taxonomy';
import { createOrUpdateCandidateProfile, getCandidateProfile } from '@/lib/seveno-candidates';
import {
  acceptSevenoTerms,
  ensureSevenoUser,
  hasSevenoTermsAcceptance,
  resolveSevenoRedirect,
} from '@/lib/seveno-users';
import { completeCandidateOnboarding } from '@/lib/seveno-candidate-onboarding';
import { consumePublicOfferReturnTo } from '@/lib/seveno-public-offer-return';
import { PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION } from '@/lib/seveno-public-search-consent';
import {
  DESIRED_CONTRACT_TYPE_OPTIONS,
  formatDesiredContractTypeLabels,
  normalizeDesiredContractTypeCodes,
} from '@/lib/seveno-desired-contract-types';
import { CandidatePrivacyNotice } from '@/components/candidate/CandidatePrivacyNotice';
import { CandidateShell } from '@/components/candidate/CandidateShell';
import { CandidateStatusCard } from '@/components/candidate/CandidateStatusCard';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import { GeographicLocationFields } from '@/components/ui/GeographicLocationFields';
import { Select } from '@/components/ui/Select';
import {
  EMPTY_GEOGRAPHIC_LOCATION,
  formatGeographicLocation,
  type GeographicLocation,
} from '@/lib/seveno-geography';
import type {
  CandidateAvailability,
  CandidateExperienceLevel,
  DesiredContractTypeCode,
  CandidateProfileStatus,
  CandidateProfileUpsertData,
  CandidateTargetJob,
} from '@/types/seveno';

const EXPERIENCE_LEVEL_OPTIONS: Array<{ value: CandidateExperienceLevel; label: string }> = [
  { value: 'beginner', label: 'Débutant' },
  { value: 'intermediate', label: 'Intermédiaire' },
  { value: 'confirmed', label: 'Confirmé' },
  { value: 'senior', label: 'Senior' },
  { value: 'expert', label: 'Expert' },
];

const AVAILABILITY_OPTIONS: Array<{ value: CandidateAvailability; label: string }> = [
  { value: 'immediate', label: 'Immédiatement' },
  { value: 'less_than_1_month', label: 'Moins d’un mois' },
  { value: 'one_to_three_months', label: 'Sous 1 à 3 mois' },
  { value: 'listening', label: 'En écoute' },
  { value: 'not_available', label: 'Non disponible' },
];

const PROFILE_STATUS_OPTIONS: Array<{ value: CandidateProfileStatus; label: string }> = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'active', label: 'Actif' },
  { value: 'paused', label: 'Suspendu' },
];

const INITIAL_SECTOR = JOB_SECTORS[0] ?? null;
const INITIAL_FAMILY = INITIAL_SECTOR?.families[0] ?? null;
const INITIAL_ROLE = INITIAL_FAMILY?.roles[0] ?? null;

type FieldErrorState = Partial<Record<
  'sectorId' | 'jobFamilyId' | 'jobRoleId' | 'desiredContractTypeCodes' | 'countryCode' | 'profileStatus' | 'anonymousVisibilityConsent',
  string
>>;

function getTaxonomySelection(nextSectorId: string, nextFamilyId?: string) {
  const sector = JOB_SECTORS.find((item) => item.code === nextSectorId) ?? null;
  const family = sector?.families.find((item) => item.code === nextFamilyId) ?? sector?.families[0] ?? null;
  const role = family?.roles[0] ?? null;

  return {
    sector,
    family,
    role,
  };
}

function resolveTargetJob(jobRoleId: string): CandidateTargetJob | null {
  for (const sector of JOB_SECTORS) {
    for (const family of sector.families) {
      const role = family.roles.find((item) => item.code === jobRoleId);
      if (role) {
        return {
          sectorId: sector.code,
          jobFamilyId: family.code,
          jobRoleId: role.code,
          label: role.label,
        };
      }
    }
  }
  return null;
}

function availabilityLabel(value: CandidateAvailability) {
  return AVAILABILITY_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function experienceLabel(value: CandidateExperienceLevel) {
  return EXPERIENCE_LEVEL_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function profileStatusLabel(value: CandidateProfileStatus) {
  return PROFILE_STATUS_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

export default function CandidateOnboardingPage() {
  const router = useRouter();
  const submissionLockRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compatibilityWarning, setCompatibilityWarning] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrorState>({});
  const [sectorId, setSectorId] = useState(INITIAL_SECTOR?.code ?? '');
  const [jobFamilyId, setJobFamilyId] = useState(INITIAL_FAMILY?.code ?? '');
  const [jobRoleId, setJobRoleId] = useState(INITIAL_ROLE?.code ?? '');
  const [targetJobs, setTargetJobs] = useState<CandidateTargetJob[]>([]);
  const [desiredContractTypeCodes, setDesiredContractTypeCodes] = useState<DesiredContractTypeCode[]>([]);
  const [location, setLocation] = useState<GeographicLocation>({ ...EMPTY_GEOGRAPHIC_LOCATION });
  const [legacyLocationArea, setLegacyLocationArea] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<CandidateExperienceLevel>('intermediate');
  const [availability, setAvailability] = useState<CandidateAvailability>('listening');
  const [professionalSelfDescription, setProfessionalSelfDescription] = useState('');
  const [professionalReputationDescription, setProfessionalReputationDescription] = useState('');
  const [profileStatus, setProfileStatus] = useState<CandidateProfileStatus>('draft');
  const [anonymousVisibilityConsent, setAnonymousVisibilityConsent] = useState(false);
  const [publicSearchVisibilityEnabled, setPublicSearchVisibilityEnabled] = useState(false);
  const [publicSearchVisibilityAcceptanceVersion, setPublicSearchVisibilityAcceptanceVersion] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [hasTermsAcceptance, setHasTermsAcceptance] = useState(false);

  const selectedSector = JOB_SECTORS.find((item) => item.code === sectorId) ?? INITIAL_SECTOR;
  const familyOptions = selectedSector?.families ?? [];
  const selectedFamily = familyOptions.find((item) => item.code === jobFamilyId) ?? familyOptions[0] ?? INITIAL_FAMILY;
  const roleOptions = selectedFamily?.roles ?? [];
  const selectedRole = roleOptions.find((item) => item.code === jobRoleId) ?? roleOptions[0] ?? INITIAL_ROLE;

  useEffect(() => {
    let active = true;

    async function loadCandidateSession() {
      try {
        if (JOB_SECTORS.length === 0) {
          throw new Error('La taxonomie métier est indisponible.');
        }

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

        const termsAcceptanceExists = hasSevenoTermsAcceptance(sevenoUser, 'candidate_account');
        setHasTermsAcceptance(termsAcceptanceExists);
        setTermsAccepted(termsAcceptanceExists);

        if (!sevenoUser.role) {
          router.replace('/onboarding');
          return;
        }

        if (sevenoUser.role !== 'candidate') {
          router.replace(resolveSevenoRedirect(sevenoUser));
          return;
        }

        const existingProfile = await getCandidateProfile(sevenoUser.uid);
        if (!active) {
          return;
        }

        if (existingProfile) {
          setIsEditing(true);
          const existingSector = JOB_SECTORS.find((item) => item.code === existingProfile.sectorId) ?? null;
          const existingFamily = existingSector?.families.find((item) => item.code === existingProfile.jobFamilyId) ?? null;
          const existingRole = existingFamily?.roles.find((item) => item.code === existingProfile.jobRoleId) ?? null;
          const warnings: string[] = [];

          const restoredTargetJobs = Array.isArray(existingProfile.targetJobRoleIds)
            ? existingProfile.targetJobRoleIds
              .map((roleId) => resolveTargetJob(roleId))
              .filter((job): job is CandidateTargetJob => Boolean(job))
            : existingRole
              ? [resolveTargetJob(existingRole.code)].filter((job): job is CandidateTargetJob => Boolean(job))
              : [];

          if (restoredTargetJobs.length > 0) {
            setTargetJobs(restoredTargetJobs.slice(0, 3));
          }
          setDesiredContractTypeCodes(normalizeDesiredContractTypeCodes(existingProfile.desiredContractTypeCodes));

          if (existingSector && existingFamily && existingRole) {
            setSectorId(existingSector.code);
            setJobFamilyId(existingFamily.code);
            setJobRoleId(existingRole.code);
          } else {
            warnings.push('L’ancien métier ne correspond plus à la taxonomie actuelle. Vérifiez la sélection.');
          }

          if (typeof existingProfile.locationArea === 'string') {
            setLegacyLocationArea(existingProfile.locationArea);
          }
          if (existingProfile.countryCode) {
            setLocation({
              countryCode: existingProfile.countryCode,
              countryName: existingProfile.countryName ?? '',
              administrativeAreaCode: existingProfile.administrativeAreaCode ?? '',
              administrativeAreaName: existingProfile.administrativeAreaName ?? '',
              city: existingProfile.city ?? '',
              cityName: existingProfile.cityName ?? '',
            });
          }
          if (EXPERIENCE_LEVEL_OPTIONS.some((option) => option.value === existingProfile.experienceLevel)) {
            setExperienceLevel(existingProfile.experienceLevel);
          } else {
            warnings.push('L’ancien niveau d’expérience a été remplacé par la valeur par défaut.');
          }
          if (AVAILABILITY_OPTIONS.some((option) => option.value === existingProfile.availability)) {
            setAvailability(existingProfile.availability);
            setProfessionalSelfDescription(typeof existingProfile.professionalSelfDescription === 'string' ? existingProfile.professionalSelfDescription : '');
            setProfessionalReputationDescription(typeof existingProfile.professionalReputationDescription === 'string' ? existingProfile.professionalReputationDescription : '');
          } else {
            warnings.push('L’ancienne disponibilité a été remplacée par la valeur par défaut.');
          }
          if (PROFILE_STATUS_OPTIONS.some((option) => option.value === existingProfile.profileStatus)) {
            setProfileStatus(existingProfile.profileStatus);
            setAnonymousVisibilityConsent(
              existingProfile.anonymousVisibilityConsent === true || existingProfile.profileStatus === 'active',
            );
            const hasCurrentPublicConsent = existingProfile.publicSearchVisibilityEnabled === true
              && existingProfile.publicSearchVisibilityAcceptedVersion === PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION
              && Boolean(existingProfile.publicSearchVisibilityAcceptedAt)
              && existingProfile.publicSearchVisibilityRevokedAt == null;
            setPublicSearchVisibilityEnabled(hasCurrentPublicConsent);
            if (existingProfile.publicSearchVisibilityEnabled === true && !hasCurrentPublicConsent) {
              warnings.push('La visibilité Web publique nécessite une nouvelle confirmation explicite de la politique actuelle.');
            }
          } else {
            warnings.push('L’ancien statut a été remplacé par brouillon.');
          }

          setCompatibilityWarning(warnings.length > 0 ? warnings.join(' ') : null);
        }

        setLoading(false);
      } catch {
        if (!active) {
          return;
        }

        setError('Le profil candidat n’a pas pu être chargé. Réessayez dans quelques instants.');
        setLoading(false);
      }
    }

    void loadCandidateSession();

    return () => {
      active = false;
    };
  }, [router]);

  function handleSectorChange(nextSectorId: string) {
    const selection = getTaxonomySelection(nextSectorId);
    setSectorId(selection.sector?.code ?? '');
    setJobFamilyId(selection.family?.code ?? '');
    setJobRoleId(selection.role?.code ?? '');
    setFieldErrors((current) => ({
      ...current,
      sectorId: undefined,
      jobFamilyId: undefined,
      jobRoleId: undefined,
    }));
  }

  function handleFamilyChange(nextFamilyId: string) {
    const selection = getTaxonomySelection(sectorId, nextFamilyId);
    setJobFamilyId(selection.family?.code ?? '');
    setJobRoleId(selection.role?.code ?? '');
    setFieldErrors((current) => ({
      ...current,
      jobFamilyId: undefined,
      jobRoleId: undefined,
    }));
  }

  function addTargetJob() {
    if (!selectedRole || !selectedSector || !selectedFamily) {
      setFieldErrors((current) => ({ ...current, jobRoleId: 'Sélectionnez un métier.' }));
      return;
    }
    if (targetJobs.some((job) => job.jobRoleId === selectedRole.code)) {
      setFieldErrors((current) => ({ ...current, jobRoleId: 'Ce métier est déjà sélectionné.' }));
      return;
    }
    if (targetJobs.length >= 3) {
      setFieldErrors((current) => ({ ...current, jobRoleId: 'Vous pouvez sélectionner au maximum trois métiers.' }));
      return;
    }

    setTargetJobs((current) => [...current, {
      sectorId: selectedSector.code,
      jobFamilyId: selectedFamily.code,
      jobRoleId: selectedRole.code,
      label: selectedRole.label,
    }]);
    setFieldErrors((current) => ({ ...current, jobRoleId: undefined }));
  }

  function removeTargetJob(roleId: string) {
    if (profileStatus === 'active' && targetJobs.length === 1) {
      setFieldErrors((current) => ({
        ...current,
        jobRoleId: 'Un profil actif doit conserver au moins un métier recherché.',
      }));
      return;
    }
    setTargetJobs((current) => current.filter((job) => job.jobRoleId !== roleId));
  }

  function toggleDesiredContractTypeCode(code: DesiredContractTypeCode) {
    setDesiredContractTypeCodes((current) => {
      const next = current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code];

      if (next.length > 0) {
        setFieldErrors((errors) => ({ ...errors, desiredContractTypeCodes: undefined }));
      }

      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || submissionLockRef.current) return;
    setError(null);
    setSuccessMessage(null);

    const nextFieldErrors: FieldErrorState = {};

    if (!sectorId) nextFieldErrors.sectorId = 'Sélectionnez un secteur.';
    if (!jobFamilyId) nextFieldErrors.jobFamilyId = 'Sélectionnez une famille métier.';
    if (targetJobs.length < 1 || targetJobs.length > 3) {
      nextFieldErrors.jobRoleId = 'Sélectionnez entre un et trois métiers recherchés.';
    }
    if (desiredContractTypeCodes.length < 1) {
      nextFieldErrors.desiredContractTypeCodes = 'Sélectionnez au moins un type de contrat recherché.';
    }
    if (!location.countryCode) nextFieldErrors.countryCode = 'Sélectionnez un pays.';
    if (!profileStatus) nextFieldErrors.profileStatus = 'Sélectionnez un statut de profil.';
    if (profileStatus === 'active' && !anonymousVisibilityConsent) {
      nextFieldErrors.anonymousVisibilityConsent = 'Confirmez la visibilité anonyme de votre profil.';
    }

    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    try {
      const authUser = await getCurrentAuthUser();
      if (!authUser) {
        router.replace('/connexion');
        return;
      }

      const sevenoUser = await ensureSevenoUser(authUser);
      if (sevenoUser.role !== 'candidate') {
        router.replace(resolveSevenoRedirect(sevenoUser));
        return;
      }

      if (!hasTermsAcceptance) {
        if (!termsAccepted) {
          setError("Vous devez accepter les Conditions générales d'utilisation de Seven’O avant d'enregistrer votre profil.");
          return;
        }
      }

      submissionLockRef.current = true;
      setSaving(true);

      if (!hasTermsAcceptance) {
        await acceptSevenoTerms(authUser);
        setTermsAccepted(true);
        setHasTermsAcceptance(true);
      }

      const payload: CandidateProfileUpsertData = {
        targetJobRoleIds: targetJobs.map((job) => job.jobRoleId),
        desiredContractTypeCodes,
        availability,
        locationArea: formatGeographicLocation(location),
        ...location,
        experienceLevel,
        professionalSelfDescription,
        professionalReputationDescription,
        profileStatus,
        anonymousVisibilityConsent,
        publicSearchVisibilityEnabled,
        ...(publicSearchVisibilityAcceptanceVersion
          ? { publicSearchVisibilityAcceptanceVersion }
          : {}),
      };

      const saveResult = await createOrUpdateCandidateProfile(authUser, payload);
      await completeCandidateOnboarding(authUser);
      const identityLabels: Record<string, string> = {
        firstName: 'prénom',
        lastName: 'nom',
        email: 'email',
        phone: 'téléphone',
      };
      const missingIdentityLabel = saveResult.identityMissingFields
        .map((field) => identityLabels[field] ?? field)
        .join(', ');
      setSuccessMessage(
        saveResult.activationDowngraded
          ? missingIdentityLabel
            ? `Profil enregistré en brouillon. Complétez votre identité privée : ${missingIdentityLabel}.`
            : !authUser.emailVerified
              ? 'Profil enregistré en brouillon. Vérifiez votre adresse email avant son activation.'
              : 'Profil enregistré en brouillon. Complétez les conditions d’activation indiquées dans votre espace candidat.'
          : 'Profil anonyme enregistré. Redirection en cours vers votre tableau de bord.',
      );

      window.setTimeout(() => {
        router.replace(consumePublicOfferReturnTo() ?? '/candidat');
      }, saveResult.activationDowngraded ? 1600 : 700);
    } catch (caughtError) {
      submissionLockRef.current = false;
      setError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : 'Le profil candidat n’a pas pu être enregistré. Vérifiez les champs puis réessayez.',
      );
      setSaving(false);
    }
  }

  return (
    <CandidateShell
      title={isEditing ? 'Modifier votre profil anonyme' : 'Construire votre profil anonyme'}
      description="Ce formulaire ne stocke aucune identité privée. Les entreprises verront votre profil anonyme et, lorsqu’elle existe, une vérification de compétences distincte."
    >
      {loading ? (
        <SevenoPanel tone="neutral" className="px-4 py-4 text-sm text-slate-300">
          Vérification de votre session...
        </SevenoPanel>
      ) : (
        <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)}>
          <Breadcrumbs
            items={[
              { label: 'Candidat', href: '/candidat' },
              { label: 'Mon profil', href: '/candidat/onboarding' },
              { label: isEditing ? 'Modifier le profil' : 'Compléter le profil' },
            ]}
          />

          {successMessage ? (
            <SevenoPanel tone="cyan" className="p-4 text-sm leading-7 text-cyan-100">
              {successMessage}
            </SevenoPanel>
          ) : null}

          {compatibilityWarning ? (
            <SevenoPanel tone="orange" className="p-4 text-sm leading-7 text-orange-100">
              {compatibilityWarning}
            </SevenoPanel>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-5">
              <SevenoPanel tone="cyan" className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Bloc 1</p>
                    <h2 className="mt-2 text-lg font-semibold text-white">Métiers recherchés</h2>
                  </div>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
                    {targetJobs.length}/3
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">
                      Secteur
                    </span>
                    <Select
                      value={sectorId}
                      onChange={(event) => handleSectorChange(event.target.value)}
                    >
                      {JOB_SECTORS.map((sector) => (
                        <option key={sector.code} value={sector.code}>
                          {sector.label}
                        </option>
                      ))}
                    </Select>
                    {fieldErrors.sectorId ? <p className="text-xs text-rose-300">{fieldErrors.sectorId}</p> : null}
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">Famille métier</span>
                    <Select
                      value={jobFamilyId}
                      onChange={(event) => handleFamilyChange(event.target.value)}
                    >
                      {familyOptions.map((family) => (
                        <option key={family.code} value={family.code}>
                          {family.label}
                        </option>
                      ))}
                    </Select>
                    {fieldErrors.jobFamilyId ? <p className="text-xs text-rose-300">{fieldErrors.jobFamilyId}</p> : null}
                  </label>
                </div>

                <div className="mt-4">
                  <label className="space-y-2 block">
                    <span className="text-sm font-medium text-slate-200">Métier précis</span>
                    <Select
                      value={jobRoleId}
                      onChange={(event) => {
                        setJobRoleId(event.target.value);
                        setFieldErrors((current) => ({ ...current, jobRoleId: undefined }));
                      }}
                    >
                      {roleOptions.map((role) => (
                        <option key={role.code} value={role.code}>
                          {role.label}
                        </option>
                      ))}
                    </Select>
                    {fieldErrors.jobRoleId ? <p className="text-xs text-rose-300">{fieldErrors.jobRoleId}</p> : null}
                  </label>
                  <button
                    type="button"
                    onClick={addTargetJob}
                    disabled={targetJobs.length >= 3}
                    className="mt-3 inline-flex rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Ajouter ce métier
                  </button>
                </div>

                <div className="mt-5 space-y-2">
                  {targetJobs.length === 0 ? (
                    <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
                      Ajoutez entre un et trois métiers recherchés.
                    </p>
                  ) : targetJobs.map((job) => (
                    <div key={job.jobRoleId} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <span className="text-sm font-medium text-white">{job.label}</span>
                      <button
                        type="button"
                        onClick={() => removeTargetJob(job.jobRoleId)}
                        className="text-xs font-semibold text-rose-200 transition hover:text-white"
                      >
                        Retirer
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Quels types de contrat recherchez-vous ?</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Plusieurs réponses sont possibles. Choisissez au moins un type de contrat.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {DESIRED_CONTRACT_TYPE_OPTIONS.map((option) => {
                      const checked = desiredContractTypeCodes.includes(option.code);
                      return (
                        <label
                          key={option.code}
                          className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-300/30 hover:bg-slate-950/55"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDesiredContractTypeCode(option.code)}
                            className="mt-1 accent-cyan-400"
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {fieldErrors.desiredContractTypeCodes ? (
                    <p className="mt-3 text-xs text-rose-300">{fieldErrors.desiredContractTypeCodes}</p>
                  ) : null}
                </div>
              </SevenoPanel>

              <div className="md:pt-[20px]">
                <SevenoPanel tone="blue" className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Bloc 2</p>
                  <h2 className="mt-2 text-lg font-semibold text-white">Situation et disponibilité</h2>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <p className="mb-3 text-sm font-medium text-slate-200">Dans quelle zone recherchez-vous ?</p>
                      <GeographicLocationFields
                        value={location}
                        onChange={(nextLocation) => {
                          setLocation(nextLocation);
                          setFieldErrors((current) => ({ ...current, countryCode: undefined }));
                        }}
                        requiredCountry
                        legacyLabel={legacyLocationArea}
                      />
                      {fieldErrors.countryCode ? <p className="mt-2 text-xs text-rose-300">{fieldErrors.countryCode}</p> : null}
                    </div>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-200">Niveau d’expérience</span>
                    <Select
                      value={experienceLevel}
                      onChange={(event) => setExperienceLevel(event.target.value as CandidateExperienceLevel)}
                    >
                      {EXPERIENCE_LEVEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-200">Quelle est votre disponibilité ?</span>
                    <Select
                      value={availability}
                      onChange={(event) => setAvailability(event.target.value as CandidateAvailability)}
                    >
                      {AVAILABILITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    </label>
                  </div>
                </SevenoPanel>
              </div>

            </div>

            <div className="space-y-5">
              <CandidatePrivacyNotice
                message="Votre identité et vos coordonnées restent privées. Les entreprises voient votre profil anonymisé et, lorsqu’il existe, votre historique d’évaluation."
              />

              <SevenoPanel tone="neutral" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Progression</p>
                <div className="mt-4 grid gap-3">
                  <CandidateStatusCard
                    tone="cyan"
                    label="Étape 1"
                    value={`${targetJobs.length}/3 métiers`}
                    note="Sélectionnez les métiers que vous recherchez, sans lier votre historique d’évaluation à un poste."
                  />
                  <CandidateStatusCard
                    tone="blue"
                    label="Étape 2"
                    value="Situation"
                    note="Exposez seulement votre zone, votre niveau et votre disponibilité."
                  />
                  <CandidateStatusCard
                    tone="orange"
                    label="Étape 3"
                    value="Visibilité"
                    note="La visibilité anonyme dépend de votre choix, pas de l’existence d’un test."
                  />
                </div>
              </SevenoPanel>
            </div>
          </div>


              <SevenoPanel tone="orange" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Bloc 3</p>
                <h2 className="mt-2 text-lg font-semibold text-white">Visibilité du profil</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] md:items-stretch">
                  <div className="space-y-4">
                    <label className="space-y-2 block">
                    <span className="text-sm font-medium text-slate-200">Statut du profil</span>
                    <Select
                      value={profileStatus}
                      onChange={(event) => {
                        const nextStatus = event.target.value as CandidateProfileStatus;
                        setProfileStatus(nextStatus);
                        if (nextStatus !== 'active') {
                          setPublicSearchVisibilityEnabled(false);
                          setPublicSearchVisibilityAcceptanceVersion(null);
                        }
                        setFieldErrors((current) => ({
                          ...current,
                          profileStatus: undefined,
                          anonymousVisibilityConsent: undefined,
                        }));
                      }}
                    >
                      {PROFILE_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    {fieldErrors.profileStatus ? <p className="text-xs text-rose-300">{fieldErrors.profileStatus}</p> : null}
                    <p className="text-xs leading-5 text-slate-400">
                      Brouillon : non visible pour l’instant. Actif : profil anonyme visible aux entreprises. Suspendu :
                      profil mis en pause.
                    </p>
                  </label>

                  {profileStatus === 'active' ? (
                    <label className="flex cursor-pointer items-start gap-3 rounded-[20px] border border-cyan-300/15 bg-cyan-400/5 p-4 text-sm leading-6 text-slate-300">
                      <input
                        type="checkbox"
                        checked={anonymousVisibilityConsent}
                        onChange={(event) => {
                          setAnonymousVisibilityConsent(event.target.checked);
                          if (!event.target.checked) {
                            setPublicSearchVisibilityEnabled(false);
                            setPublicSearchVisibilityAcceptanceVersion(null);
                          }
                          setFieldErrors((current) => ({ ...current, anonymousVisibilityConsent: undefined }));
                        }}
                        className="mt-1 accent-cyan-400"
                      />
                      <span>
                        J’accepte que mon profil métier anonyme soit visible par les entreprises. Mon identité et mes coordonnées restent privées.
                        {fieldErrors.anonymousVisibilityConsent ? (
                          <span className="mt-1 block text-xs text-rose-300">{fieldErrors.anonymousVisibilityConsent}</span>
                        ) : null}
                      </span>
                    </label>
                  ) : null}

                  <label className={`flex items-start gap-3 rounded-[20px] border p-4 text-sm leading-6 ${profileStatus === 'active' && anonymousVisibilityConsent ? 'cursor-pointer border-blue-300/20 bg-blue-400/5 text-slate-300' : 'cursor-not-allowed border-white/10 bg-white/[0.03] text-slate-500'}`}>
                    <input
                      type="checkbox"
                      checked={publicSearchVisibilityEnabled}
                      disabled={profileStatus !== 'active' || !anonymousVisibilityConsent}
                      onChange={(event) => {
                        setPublicSearchVisibilityEnabled(event.target.checked);
                        setPublicSearchVisibilityAcceptanceVersion(
                          event.target.checked ? PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION : null,
                        );
                      }}
                      className="mt-1 accent-blue-400"
                    />
                    <span>
                      <span className="block font-medium text-white">Rendre mon profil professionnel visible publiquement</span>
                      <span className="mt-1 block">
                        Permettre aux entreprises de découvrir mon profil anonyme depuis Seven’O, les moteurs de recherche et les services de recherche IA.
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-slate-400">
                        Cette option est facultative et distincte de la visibilité auprès des entreprises Seven’O. Vous pouvez la désactiver à tout moment. Le retrait des caches des moteurs de recherche peut prendre un certain temps.
                      </span>
                    </span>
                  </label>

                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300 md:h-full">
                    <p className="font-medium text-white">Récapitulatif anonyme</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <p className="md:col-span-2">
                        Métiers : {targetJobs.length > 0 ? targetJobs.map((job) => job.label).join(', ') : 'Non renseignés'}
                      </p>
                      <p className="md:col-span-2">
                        Contrats recherchés : {formatDesiredContractTypeLabels(desiredContractTypeCodes)}
                      </p>
                      <p>Zone : {formatGeographicLocation(location, legacyLocationArea) || 'Non renseignée'}</p>
                      <p>Expérience : {experienceLabel(experienceLevel)}</p>
                      <p>Disponibilité : {availabilityLabel(availability)}</p>
                      <p>Statut : {profileStatusLabel(profileStatus)}</p>
                    </div>
                  </div>
                </div>
              </SevenoPanel>

              <SevenoPanel tone="neutral" className="p-5">
                <label className="flex items-start gap-3 rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(event) => setTermsAccepted(event.target.checked)}
                    className="mt-1 accent-cyan-400"
                    disabled={hasTermsAcceptance}
                  />
                  <span>
                    J’ai lu et j’accepte les Conditions générales d’utilisation de Seven’O.
                  </span>
                </label>
                <p className="mt-3 text-xs leading-6 text-slate-400">
                  La version 1.0 des CGU est enregistrée avec un horodatage serveur avant la validation du profil.
                </p>
              </SevenoPanel>

              <SevenoPanel tone="neutral" className="p-5" id="presentation">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Bloc 4</p>
                    <h2 className="mt-2 text-lg font-semibold text-white">Présentation professionnelle</h2>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
                    Facultatif mais recommandé
                  </span>
                </div>

                <div className="mt-5 grid gap-4">
                  <label className="space-y-2 block">
                    <span className="text-sm font-medium text-slate-200">Ce que vous diriez de vous</span>
                    <textarea
                      value={professionalSelfDescription}
                      onChange={(event) => setProfessionalSelfDescription(event.target.value)}
                      rows={5}
                      maxLength={600}
                      placeholder="Décrivez votre parcours, votre manière de travailler et ce que vous apportez."
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                    />
                  </label>

                  <label className="space-y-2 block">
                    <span className="text-sm font-medium text-slate-200">Ce que les autres disent de vous</span>
                    <textarea
                      value={professionalReputationDescription}
                      onChange={(event) => setProfessionalReputationDescription(event.target.value)}
                      rows={5}
                      maxLength={600}
                      placeholder="Résumé des retours de vos anciens collègues, managers ou clients."
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                    />
                  </label>
                </div>

                <p className="mt-4 text-xs leading-5 text-slate-400">
                  Ces textes alimentent votre profil candidat privé et les recommandations visibles une fois vérifiées.
                </p>
              </SevenoPanel>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving || (!hasTermsAcceptance && !termsAccepted)}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-500 px-6 py-4 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Enregistrement...' : isEditing ? 'Enregistrer mes modifications' : 'Enregistrer mon profil anonyme'}
            </button>

          </div>
        </form>
      )}

      {error ? (
        <p className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
    </CandidateShell>
  );
}
