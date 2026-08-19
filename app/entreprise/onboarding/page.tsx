'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentAuthUser } from '@/lib/auth';
import { JOB_SECTORS, findSectorLabel } from '@/lib/job-taxonomy';
import { COMPANY_PROFILE_LIMITS, getCompanyProfile } from '@/lib/seveno-companies';
import { getCompanyContextClient } from '@/lib/seveno-billing-client';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import {
  acceptSevenoTerms,
  ensureSevenoUser,
  hasSevenoTermsAcceptance,
  resolveSevenoRedirect,
} from '@/lib/seveno-users';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { Select } from '@/components/ui/Select';
import type { CompanyProfileUpsertData, CompanySize } from '@/types/seveno';

const COMPANY_SIZE_OPTIONS: Array<{ value: CompanySize; label: string }> = [
  { value: 'solo', label: 'Solo' },
  { value: '1_9', label: '1 a 9' },
  { value: '10_49', label: '10 a 49' },
  { value: '50_249', label: '50 a 249' },
  { value: '250_plus', label: '250 et plus' },
];

function normalizeSiretInput(value: string) {
  return value.replace(/\D+/g, '');
}

function getCompanyProfileValidationMessage(input: {
  companyName: string;
  companyType: string;
  legalName: string;
  website: string;
  businessSector: string;
  companySize: CompanySize;
  headquartersArea: string;
  recruitmentAreas: string[];
  contactRole: string;
  siret: string;
}) {
  if (input.companyName.trim().length === 0) {
    return 'Le nom commercial est obligatoire.';
  }

  if (input.companyName.trim().length > COMPANY_PROFILE_LIMITS.companyName) {
    return `Le nom commercial doit contenir au maximum ${COMPANY_PROFILE_LIMITS.companyName} caractères.`;
  }

  if (input.companyType.trim().length === 0) {
    return "Le type d’entreprise est obligatoire.";
  }

  if (input.companyType.trim().length > COMPANY_PROFILE_LIMITS.companyType) {
    return `Le type d’entreprise doit contenir au maximum ${COMPANY_PROFILE_LIMITS.companyType} caractères.`;
  }

  if (input.legalName.trim().length > COMPANY_PROFILE_LIMITS.legalName) {
    return `La raison sociale doit contenir au maximum ${COMPANY_PROFILE_LIMITS.legalName} caractères.`;
  }

  if (input.website.trim().length > COMPANY_PROFILE_LIMITS.website) {
    return `Le site web doit contenir au maximum ${COMPANY_PROFILE_LIMITS.website} caractères.`;
  }

  if (input.businessSector.trim().length === 0) {
    return "Le secteur d’activité est obligatoire.";
  }

  if (input.businessSector.trim().length > COMPANY_PROFILE_LIMITS.businessSector) {
    return `Le secteur d’activité doit contenir au maximum ${COMPANY_PROFILE_LIMITS.businessSector} caractères.`;
  }

  if (!input.companySize) {
    return "La taille de l entreprise est obligatoire.";
  }

  if (input.headquartersArea.trim().length === 0) {
    return 'La zone du siege est obligatoire.';
  }

  if (input.headquartersArea.trim().length > COMPANY_PROFILE_LIMITS.headquartersArea) {
    return `La zone du siège doit contenir au maximum ${COMPANY_PROFILE_LIMITS.headquartersArea} caractères.`;
  }

  if (input.recruitmentAreas.length === 0) {
    return 'Ajoutez au moins une zone de recrutement.';
  }

  if (input.recruitmentAreas.length > COMPANY_PROFILE_LIMITS.recruitmentAreas) {
    return `Ajoutez au maximum ${COMPANY_PROFILE_LIMITS.recruitmentAreas} zones de recrutement.`;
  }

  if (input.contactRole.trim().length === 0) {
    return 'La fonction du contact est obligatoire.';
  }

  if (input.contactRole.trim().length > COMPANY_PROFILE_LIMITS.contactRole) {
    return `La fonction du contact doit contenir au maximum ${COMPANY_PROFILE_LIMITS.contactRole} caractères.`;
  }

  if (input.siret.length > 0 && input.siret.length !== 14) {
    return 'Le SIRET doit contenir exactement 14 chiffres.';
  }

  return null;
}

export default function CompanyOnboardingPage() {
  const router = useRouter();
  const submissionLockRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [compatibilityWarning, setCompatibilityWarning] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [legalName, setLegalName] = useState('');
  const [siret, setSiret] = useState('');
  const [website, setWebsite] = useState('');
  const [businessSector, setBusinessSector] = useState(JOB_SECTORS[0]?.code ?? '');
  const [companySize, setCompanySize] = useState<CompanySize>('1_9');
  const [headquartersArea, setHeadquartersArea] = useState('');
  const [recruitmentAreas, setRecruitmentAreas] = useState<string[]>(['']);
  const [contactRole, setContactRole] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [hasTermsAcceptance, setHasTermsAcceptance] = useState(false);

  const selectedBusinessSectorLabel = findSectorLabel(businessSector) ?? businessSector;

  useEffect(() => {
    let active = true;

    async function loadCompanyOnboarding() {
      try {
        if (JOB_SECTORS.length === 0) {
          throw new Error("La taxonomie des secteurs n’est pas disponible.");
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

        const termsAcceptanceExists = hasSevenoTermsAcceptance(sevenoUser, 'company_first_access');
        setHasTermsAcceptance(termsAcceptanceExists);
        setTermsAccepted(termsAcceptanceExists);

        if (!sevenoUser.role) {
          router.replace('/onboarding');
          return;
        }

        if (sevenoUser.role !== 'company') {
          router.replace(resolveSevenoRedirect(sevenoUser));
          return;
        }

        const companyContext = sevenoUser.onboardingCompleted ? await getCompanyContextClient(authUser) : null;
        const activeMembership = companyContext?.companies.find((company) => company.companyId === companyContext.activeCompanyId);
        if (activeMembership && activeMembership.role !== 'owner') {
          router.replace('/entreprise');
          return;
        }
        const existingProfile = companyContext?.activeProfile ?? await getCompanyProfile(sevenoUser.uid);
        if (!active) {
          return;
        }

        if (existingProfile) {
          setIsEditing(true);
          const warnings: string[] = [];
          if (
            typeof existingProfile.companyName !== 'string'
            || existingProfile.companyName.trim().length === 0
            || typeof existingProfile.companyType !== 'string'
            || existingProfile.companyType.trim().length === 0
            || typeof existingProfile.headquartersArea !== 'string'
            || existingProfile.headquartersArea.trim().length === 0
            || typeof existingProfile.contactRole !== 'string'
            || existingProfile.contactRole.trim().length === 0
          ) {
            warnings.push('Certains champs obligatoires de l’ancien profil doivent être complétés.');
          }
          setCompanyName(typeof existingProfile.companyName === 'string' ? existingProfile.companyName : '');
          setCompanyType(typeof existingProfile.companyType === 'string' ? existingProfile.companyType : '');
          setLegalName(typeof existingProfile.legalName === 'string' ? existingProfile.legalName : '');
          setSiret(typeof existingProfile.siret === 'string' ? normalizeSiretInput(existingProfile.siret) : '');
          setWebsite(typeof existingProfile.website === 'string' ? existingProfile.website : '');
          setHeadquartersArea(
            typeof existingProfile.headquartersArea === 'string' ? existingProfile.headquartersArea : '',
          );
          setContactRole(typeof existingProfile.contactRole === 'string' ? existingProfile.contactRole : '');

          if (JOB_SECTORS.some((sector) => sector.code === existingProfile.businessSector)) {
            setBusinessSector(existingProfile.businessSector);
          } else {
            warnings.push('L’ancien secteur n’existe plus dans la taxonomie. Vérifiez la sélection.');
          }
          if (COMPANY_SIZE_OPTIONS.some((option) => option.value === existingProfile.companySize)) {
            setCompanySize(existingProfile.companySize);
          } else {
            warnings.push('L’ancienne taille d’entreprise a été remplacée par la valeur par défaut.');
          }

          const existingAreas = Array.isArray(existingProfile.recruitmentAreas)
            ? existingProfile.recruitmentAreas.filter(
                (area): area is string => typeof area === 'string' && area.trim().length > 0,
              )
            : [];
          setRecruitmentAreas(existingAreas.length > 0 ? existingAreas : ['']);
          if (existingAreas.length === 0) {
            warnings.push('Aucune zone de recrutement compatible n’a été trouvée. Complétez ce champ.');
          }

          setCompatibilityWarning(warnings.length > 0 ? warnings.join(' ') : null);
        }

        setLoading(false);
      } catch {
        if (!active) {
          return;
        }

        setError("Le profil entreprise n’a pas pu être chargé. Réessayez dans quelques instants.");
        setLoading(false);
      }
    }

    void loadCompanyOnboarding();

    return () => {
      active = false;
    };
  }, [router]);

  function updateRecruitmentArea(index: number, value: string) {
    setRecruitmentAreas((current) =>
      current.map((entry, currentIndex) => (currentIndex === index ? value : entry)),
    );
  }

  function addRecruitmentArea() {
    if (recruitmentAreas.length >= COMPANY_PROFILE_LIMITS.recruitmentAreas) {
      return;
    }

    setRecruitmentAreas((current) => [...current, '']);
  }

  function removeRecruitmentArea(index: number) {
    setRecruitmentAreas((current) => {
      if (current.length === 1) {
        return [''];
      }

      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || submissionLockRef.current) return;
    setError(null);
    setSuccessMessage(null);

    try {
      const normalizedRecruitmentAreas = recruitmentAreas
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

      const normalizedSiret = normalizeSiretInput(siret);
      const validationMessage = getCompanyProfileValidationMessage({
        companyName,
        companyType,
        legalName,
        website,
        businessSector,
        companySize,
        headquartersArea,
        recruitmentAreas: normalizedRecruitmentAreas,
        contactRole,
        siret: normalizedSiret,
      });

      if (validationMessage) {
        setError(validationMessage);
        return;
      }

      const authUser = await getCurrentAuthUser();
      if (!authUser) {
        router.replace('/connexion');
        return;
      }

      const sevenoUser = await ensureSevenoUser(authUser);
      if (sevenoUser.role !== 'company') {
        router.replace(resolveSevenoRedirect(sevenoUser));
        return;
      }

      if (!hasTermsAcceptance) {
        if (!termsAccepted) {
          setError("Vous devez accepter les Conditions générales d'utilisation de Seven’O avant d'enregistrer votre profil entreprise.");
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

      const payload: CompanyProfileUpsertData = {
        companyName,
        companyType,
        legalName,
        siret: normalizedSiret || undefined,
        website,
        businessSector,
        companySize,
        headquartersArea,
        recruitmentAreas: normalizedRecruitmentAreas,
        contactRole,
      };

      const created = await fetchSevenoMatchApi<{ companyId: string }>(authUser, '/api/seveno/companies/onboarding', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      window.localStorage.setItem('seveno_active_company_id', created.companyId);
      setSuccessMessage('Profil entreprise enregistré. Redirection en cours vers votre dashboard.');
      window.setTimeout(() => router.replace('/entreprise'), 700);
    } catch {
      submissionLockRef.current = false;
      setError("Le profil entreprise n’a pas pu être enregistré. Vérifiez les champs puis réessayez.");
      setSaving(false);
    }
  }

  const recruitmentAreasSummary = recruitmentAreas
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgb(var(--seveno-brand-blue)/0.16),transparent_30%),linear-gradient(180deg,#020617_0%,#020817_45%,#020617_100%)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[86.4rem] items-center justify-center px-5 py-10 sm:px-8">
        <section className="w-full max-w-[67.2rem] rounded-[32px] border border-blue-400/10 bg-[linear-gradient(180deg,rgba(12,14,34,0.96),rgba(8,15,28,0.94))] p-6 shadow-[0_24px_90px_rgba(2,6,23,0.42)] backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/80">Onboarding entreprise</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                {isEditing ? 'Modifier votre profil entreprise' : 'Construire votre profil entreprise'}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                Les entreprises ne doivent jamais voir les données privées candidat. Ce formulaire ne stocke que
                les informations utiles au profil anonyme côté entreprise.
              </p>
            </div>

          </div>

          <Breadcrumbs
            className="mt-6"
            items={[
              { label: 'Entreprise', href: '/entreprise' },
              { label: 'Profil entreprise' },
            ]}
          />

          {loading ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
              Vérification de votre session...
            </div>
          ) : (
            <form className="mt-8 space-y-6" onSubmit={(event) => void handleSubmit(event)}>
              {successMessage ? (
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                  {successMessage}
                </div>
              ) : null}

              {compatibilityWarning ? (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  {compatibilityWarning}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Nom commercial *</span>
                  <input
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    type="text"
                    maxLength={COMPANY_PROFILE_LIMITS.companyName}
                    placeholder="Seven’O SAS"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/40"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Type d’entreprise *</span>
                  <input
                    value={companyType}
                    onChange={(event) => setCompanyType(event.target.value)}
                    type="text"
                    maxLength={COMPANY_PROFILE_LIMITS.companyType}
                    placeholder="Startup, PME, ETI, grand groupe..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/40"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Raison sociale</span>
                  <input
                    value={legalName}
                    onChange={(event) => setLegalName(event.target.value)}
                    type="text"
                    maxLength={COMPANY_PROFILE_LIMITS.legalName}
                    placeholder="Seven O Recrutement"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/40"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">SIRET</span>
                  <input
                    value={siret}
                    onChange={(event) => setSiret(event.target.value)}
                    type="text"
                    inputMode="numeric"
                    maxLength={COMPANY_PROFILE_LIMITS.siret}
                    placeholder="14 chiffres, espaces ignorés"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/40"
                  />
                  <p className="text-xs leading-5 text-slate-400">
                    Optionnel. Le chiffre est nettoyé avant stockage, sans vérification externe.
                  </p>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Site web</span>
                  <input
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                    type="url"
                    maxLength={COMPANY_PROFILE_LIMITS.website}
                    placeholder="https://www.seveno.fr"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/40"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Secteur d’activité *</span>
                  <Select
                    value={businessSector}
                    onChange={(event) => setBusinessSector(event.target.value)}
                  >
                    {JOB_SECTORS.map((sector) => (
                      <option key={sector.code} value={sector.code}>
                        {sector.label}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Taille de l’entreprise *</span>
                  <Select
                    value={companySize}
                    onChange={(event) => setCompanySize(event.target.value as CompanySize)}
                  >
                    {COMPANY_SIZE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Zone du siège *</span>
                  <input
                    value={headquartersArea}
                    onChange={(event) => setHeadquartersArea(event.target.value)}
                    type="text"
                    maxLength={COMPANY_PROFILE_LIMITS.headquartersArea}
                    placeholder="Paris, Lyon, remote..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/40"
                  />
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-200">Zones de recrutement *</p>
                    <p className="text-xs leading-5 text-slate-400">
                      Une ou plusieurs zones géographiques, séparées visuellement mais stockées dans un tableau.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addRecruitmentArea}
                    disabled={recruitmentAreas.length >= COMPANY_PROFILE_LIMITS.recruitmentAreas}
                    className="rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-2 text-sm font-medium text-blue-100 transition hover:border-blue-300/30 hover:bg-blue-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Ajouter une zone
                  </button>
                  <p className="mt-3 basis-full text-xs leading-5 text-slate-400">
                    Limite: {COMPANY_PROFILE_LIMITS.recruitmentAreas} zones max.
                  </p>
                </div>

                <div className="space-y-3">
                  {recruitmentAreas.map((area, index) => (
                    <div key={`recruitment-area-${index}`} className="flex gap-3">
                      <input
                        value={area}
                        onChange={(event) => updateRecruitmentArea(index, event.target.value)}
                        type="text"
                        maxLength={120}
                        placeholder={`Zone ${index + 1} - Ile-de-France, remote national...`}
                        className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/40"
                      />
                      <button
                        type="button"
                        onClick={() => removeRecruitmentArea(index)}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={recruitmentAreas.length === 1}
                      >
                        Retirer
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Fonction du contact *</span>
                  <input
                    value={contactRole}
                    onChange={(event) => setContactRole(event.target.value)}
                    type="text"
                    maxLength={COMPANY_PROFILE_LIMITS.contactRole}
                    placeholder="Responsable recrutement, fondateur, RH..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/40"
                  />
                </label>

                <div className="rounded-[24px] border border-blue-400/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
                  <p className="font-medium text-white">Recapitulatif</p>
                  <div className="mt-3 space-y-1">
                    <p>Secteur: {selectedBusinessSectorLabel}</p>
                    <p>Taille: {COMPANY_SIZE_OPTIONS.find((option) => option.value === companySize)?.label ?? companySize}</p>
                    <p>Zones: {recruitmentAreasSummary.length}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm leading-7 text-slate-300">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(event) => setTermsAccepted(event.target.checked)}
                    className="mt-1 accent-blue-400"
                    disabled={hasTermsAcceptance}
                  />
                  <span>
                    Je confirme être habilité à représenter l’entreprise et j’accepte les Conditions générales d’utilisation de Seven’O.
                  </span>
                </label>
                <p className="mt-3 text-xs leading-6 text-slate-400">
                  La version 1.0 des CGU est enregistrée avec un horodatage serveur avant la validation du profil entreprise.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={saving || (!hasTermsAcceptance && !termsAccepted)}
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 via-blue-500 to-cyan-500 px-6 py-4 text-sm font-semibold text-white shadow-[0_18px_50px_rgb(var(--seveno-brand-blue)/0.18)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? 'Enregistrement...' : isEditing ? 'Enregistrer mes modifications' : 'Enregistrer mon entreprise'}
                </button>

              </div>

              <p className="text-xs leading-6 text-slate-400">
                Le formulaire valide le profil avant envoi. Si une information requise manque, un message explicite
                apparaît au lieu d’un échec silencieux.
              </p>
            </form>
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
