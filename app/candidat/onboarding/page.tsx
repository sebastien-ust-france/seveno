'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentAuthUser } from '@/lib/auth';
import { JOB_SECTORS } from '@/lib/job-taxonomy';
import { createOrUpdateCandidateProfile, getCandidateProfile } from '@/lib/seveno-candidates';
import { ensureSevenoUser, markUserOnboardingCompleted, resolveSevenoRedirect } from '@/lib/seveno-users';
import { CandidatePrivacyNotice } from '@/components/candidate/CandidatePrivacyNotice';
import { CandidateShell } from '@/components/candidate/CandidateShell';
import { CandidateStatusCard } from '@/components/candidate/CandidateStatusCard';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import type {
  CandidateAvailability,
  CandidateExperienceLevel,
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
  'sectorId' | 'jobFamilyId' | 'jobRoleId' | 'locationArea' | 'profileStatus' | 'anonymousVisibilityConsent',
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
  const [locationArea, setLocationArea] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<CandidateExperienceLevel>('intermediate');
  const [availability, setAvailability] = useState<CandidateAvailability>('listening');
  const [profileStatus, setProfileStatus] = useState<CandidateProfileStatus>('draft');
  const [anonymousVisibilityConsent, setAnonymousVisibilityConsent] = useState(false);

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

          if (existingSector && existingFamily && existingRole) {
            setSectorId(existingSector.code);
            setJobFamilyId(existingFamily.code);
            setJobRoleId(existingRole.code);
          } else {
            warnings.push('L’ancien métier ne correspond plus à la taxonomie actuelle. Vérifiez la sélection.');
          }

          if (typeof existingProfile.locationArea === 'string') {
            setLocationArea(existingProfile.locationArea);
          }
          if (EXPERIENCE_LEVEL_OPTIONS.some((option) => option.value === existingProfile.experienceLevel)) {
            setExperienceLevel(existingProfile.experienceLevel);
          } else {
            warnings.push('L’ancien niveau d’expérience a été remplacé par la valeur par défaut.');
          }
          if (AVAILABILITY_OPTIONS.some((option) => option.value === existingProfile.availability)) {
            setAvailability(existingProfile.availability);
          } else {
            warnings.push('L’ancienne disponibilité a été remplacée par la valeur par défaut.');
          }
          if (PROFILE_STATUS_OPTIONS.some((option) => option.value === existingProfile.profileStatus)) {
            setProfileStatus(existingProfile.profileStatus);
            setAnonymousVisibilityConsent(existingProfile.profileStatus === 'active');
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
    if (!locationArea.trim()) nextFieldErrors.locationArea = 'Indiquez une zone de recherche.';
    if (!profileStatus) nextFieldErrors.profileStatus = 'Sélectionnez un statut de profil.';
    if (profileStatus === 'active' && !anonymousVisibilityConsent) {
      nextFieldErrors.anonymousVisibilityConsent = 'Confirmez la visibilité anonyme de votre profil.';
    }

    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    submissionLockRef.current = true;
    setSaving(true);

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

      const payload: CandidateProfileUpsertData = {
        targetJobRoleIds: targetJobs.map((job) => job.jobRoleId),
        availability,
        locationArea,
        experienceLevel,
        profileStatus,
        anonymousVisibilityConsent,
      };

      const saveResult = await createOrUpdateCandidateProfile(authUser, payload);
      await markUserOnboardingCompleted(sevenoUser.uid);
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
              : saveResult.assessmentRequired
                ? "Profil enregistré en brouillon. Terminez le questionnaire Seven’O avant de l’activer."
                : 'Profil enregistré en brouillon. Complétez les conditions d’activation indiquées dans votre espace candidat.'
          : 'Profil anonyme enregistré. Redirection en cours vers votre tableau de bord.',
      );

      window.setTimeout(() => {
        router.replace('/candidat');
      }, saveResult.activationDowngraded ? 1600 : 700);
    } catch {
      submissionLockRef.current = false;
      setError('Le profil candidat n’a pas pu être enregistré. Vérifiez les champs puis réessayez.');
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
                    <select
                      value={sectorId}
                      onChange={(event) => handleSectorChange(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    >
                      {JOB_SECTORS.map((sector) => (
                        <option key={sector.code} value={sector.code}>
                          {sector.label}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.sectorId ? <p className="text-xs text-rose-300">{fieldErrors.sectorId}</p> : null}
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">Famille métier</span>
                    <select
                      value={jobFamilyId}
                      onChange={(event) => handleFamilyChange(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    >
                      {familyOptions.map((family) => (
                        <option key={family.code} value={family.code}>
                          {family.label}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.jobFamilyId ? <p className="text-xs text-rose-300">{fieldErrors.jobFamilyId}</p> : null}
                  </label>
                </div>

                <div className="mt-4">
                  <label className="space-y-2 block">
                    <span className="text-sm font-medium text-slate-200">Métier précis</span>
                    <select
                      value={jobRoleId}
                      onChange={(event) => {
                        setJobRoleId(event.target.value);
                        setFieldErrors((current) => ({ ...current, jobRoleId: undefined }));
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    >
                      {roleOptions.map((role) => (
                        <option key={role.code} value={role.code}>
                          {role.label}
                        </option>
                      ))}
                    </select>
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
              </SevenoPanel>

              <div className="md:pt-[20px]">
                <SevenoPanel tone="violet" className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Bloc 2</p>
                  <h2 className="mt-2 text-lg font-semibold text-white">Situation et disponibilité</h2>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium text-slate-200">Dans quelle zone recherchez-vous ?</span>
                      <input
                        value={locationArea}
                        onChange={(event) => {
                          setLocationArea(event.target.value);
                          setFieldErrors((current) => ({ ...current, locationArea: undefined }));
                        }}
                        type="text"
                      placeholder="Île-de-France, télétravail, Lille..."
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                      />
                      {fieldErrors.locationArea ? <p className="text-xs text-rose-300">{fieldErrors.locationArea}</p> : null}
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-200">Niveau d’expérience</span>
                      <select
                        value={experienceLevel}
                        onChange={(event) => setExperienceLevel(event.target.value as CandidateExperienceLevel)}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      >
                        {EXPERIENCE_LEVEL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-200">Quelle est votre disponibilité ?</span>
                      <select
                        value={availability}
                        onChange={(event) => setAvailability(event.target.value as CandidateAvailability)}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      >
                        {AVAILABILITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </SevenoPanel>
              </div>

            </div>

            <div className="space-y-5">
              <CandidatePrivacyNotice
                message="Votre identité et vos coordonnées restent privées. Les entreprises voient votre profil anonymisé et, uniquement lorsqu’il existe, votre résultat vérifié."
              />

              <SevenoPanel tone="neutral" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Progression</p>
                <div className="mt-4 grid gap-3">
                  <CandidateStatusCard
                    tone="cyan"
                    label="Étape 1"
                    value={`${targetJobs.length}/3 métiers`}
                    note="Sélectionnez les métiers que vous recherchez, sans lier votre Indice Seven’O à un poste."
                  />
                  <CandidateStatusCard
                    tone="violet"
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
                    <select
                      value={profileStatus}
                      onChange={(event) => {
                        setProfileStatus(event.target.value as CandidateProfileStatus);
                        setFieldErrors((current) => ({
                          ...current,
                          profileStatus: undefined,
                          anonymousVisibilityConsent: undefined,
                        }));
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    >
                      {PROFILE_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
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

                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300 md:h-full">
                    <p className="font-medium text-white">Récapitulatif anonyme</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <p className="md:col-span-2">
                        Métiers : {targetJobs.length > 0 ? targetJobs.map((job) => job.label).join(', ') : 'Non renseignés'}
                      </p>
                      <p>Zone : {locationArea || 'Non renseignée'}</p>
                      <p>Expérience : {experienceLabel(experienceLevel)}</p>
                      <p>Disponibilité : {availabilityLabel(availability)}</p>
                      <p>Statut : {profileStatusLabel(profileStatus)}</p>
                    </div>
                  </div>
                </div>
              </SevenoPanel>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-6 py-4 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
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
