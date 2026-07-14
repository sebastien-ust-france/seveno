'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from 'firebase/auth';
import { getCurrentAuthUser } from '@/lib/auth';
import { findFamilyLabel, findRoleLabel, findSectorLabel } from '@/lib/job-taxonomy';
import { getCandidateProfile } from '@/lib/seveno-candidates';
import { isCandidateIdentityComplete } from '@/lib/seveno-candidate-identity';
import { ensureSevenoUser, resolveSevenoRedirect } from '@/lib/seveno-users';
import { CandidateProgress, type CandidateProgressState } from '@/components/candidate/CandidateProgress';
import { CandidateShell } from '@/components/candidate/CandidateShell';
import { CandidateStatusCard } from '@/components/candidate/CandidateStatusCard';
import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import {
  confirmCandidateAvailabilityFromDashboard,
  registerCandidateAvailabilityDevice,
  requestCandidateAvailabilityPushToken,
  updateCandidateAvailabilityNotifications,
} from '@/lib/seveno-candidate-availability-client';
import { getCandidateAvailabilityView } from '@/lib/seveno-candidate-availability';
import { listApplicationsClient } from '@/lib/seveno-job-applications';
import type { SerializedCandidateJobApplication } from '@/types/seveno-job-applications';
import type {
  CandidateAvailability,
  CandidateExperienceLevel,
  CandidateProfile,
  CandidateProfileStatus,
  SevenoUser,
} from '@/types/seveno';

const AVAILABILITY_LABELS: Record<CandidateAvailability, string> = {
  immediate: 'Immédiatement',
  less_than_1_month: "Moins d'un mois",
  one_to_three_months: 'Sous 1 à 3 mois',
  listening: 'En écoute',
  not_available: 'Non disponible',
};

const EXPERIENCE_LABELS: Record<CandidateExperienceLevel, string> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  confirmed: 'Confirmé',
  senior: 'Senior',
  expert: 'Expert',
};

const PROFILE_STATUS_LABELS: Record<CandidateProfileStatus, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  paused: 'En pause',
};

type CandidateSummaryCard = {
  tone: 'cyan' | 'violet' | 'orange' | 'neutral';
  label: string;
  value: string;
  note: string;
  action?: ReactNode;
};

type CandidateAssessmentSummary = {
  status: 'completed';
  overallScore: number;
  questionnaireVersion: string;
  completedAt: string;
};

function formatPublicStatusLabel(value: CandidateProfileStatus) {
  return PROFILE_STATUS_LABELS[value] ?? value;
}

function formatAvailabilityLabel(value: CandidateAvailability) {
  return AVAILABILITY_LABELS[value] ?? value;
}

function formatExperienceLabel(value: CandidateExperienceLevel) {
  return EXPERIENCE_LABELS[value] ?? value;
}

function toDateValue(value: unknown) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }

  return null;
}

function formatDateTime(value: unknown) {
  const date = toDateValue(value);
  if (!date) {
    return 'Non renseigné';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function isCandidateProfileComplete(profile: CandidateProfile) {
  const targetJobRoleIds = Array.isArray(profile.targetJobRoleIds)
    ? profile.targetJobRoleIds.filter(Boolean)
    : profile.jobRoleId
      ? [profile.jobRoleId]
      : [];
  return Boolean(
    targetJobRoleIds.length >= 1
    && targetJobRoleIds.length <= 3
    && profile.locationArea?.trim()
    && AVAILABILITY_LABELS[profile.availability]
    && EXPERIENCE_LABELS[profile.experienceLevel],
  );
}

function hasCompletedSevenoAssessment(profile: CandidateProfile) {
  return profile.sevenoAssessmentStatus === 'completed'
    && typeof profile.sevenoAssessmentOverallScore === 'number'
    && Number.isFinite(profile.sevenoAssessmentOverallScore)
    && toDateValue(profile.sevenoAssessmentCompletedAt) !== null
    && Boolean(profile.sevenoAssessmentVersion)
    && Boolean(profile.sevenoAssessmentResultId)
    && Boolean(profile.sevenoAssessmentSessionId);
}

function getProgressState(
  profile: CandidateProfile,
  invitationCount: number,
  acceptedRelationsCount: number,
  profileComplete: boolean,
  assessmentCompleted: boolean,
): {
  steps: Array<{ label: string; description: string; state: CandidateProgressState }>;
} {
  return {
    steps: [
      {
        label: 'Profil complet',
        description: profileComplete
          ? 'Vos informations métier obligatoires sont renseignées.'
          : 'Complétez les informations obligatoires de votre profil.',
        state: profileComplete ? 'done' : 'current',
      },
      {
        label: "Évaluation Seven'O",
        description: assessmentCompleted
          ? "Votre questionnaire général Seven'O est terminé."
          : "Répondez au questionnaire général Seven'O.",
        state: assessmentCompleted ? 'done' : 'current',
      },
      {
        label: 'Métiers recherchés',
        description: `${profile.targetJobRoleIds?.length ?? 1}/3 métier(s) sélectionné(s).`,
        state: profileComplete ? 'done' : 'todo',
      },
      {
        label: 'Profil visible',
        description:
          profile.profileStatus === 'active' && profileComplete
            ? 'Votre projection anonyme peut être consultée par les entreprises.'
            : 'Complétez le profil puis activez sa visibilité anonyme.',
        state:
          profile.profileStatus === 'active' && profileComplete
            ? 'done'
            : profile.profileStatus === 'paused'
              ? 'blocked'
              : 'todo',
      },
      {
        label: 'Mises en relation',
        description:
          acceptedRelationsCount > 0
            ? 'Une relation est déjà ouverte.'
            : invitationCount > 0
              ? 'Une invitation vous attend.'
              : 'Les invitations arrivent ici.',
        state: acceptedRelationsCount > 0 ? 'done' : invitationCount > 0 ? 'current' : 'todo',
      },
    ],
  };
}

function getProfileAction(
  profile: CandidateProfile,
  profileComplete: boolean,
): { href: string; label: string } {
  return {
    href: '/candidat/onboarding',
    label: !profileComplete || profile.profileStatus === 'draft' ? 'Compléter mon profil' : 'Modifier mon profil',
  };
}

export default function CandidateDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [user, setUser] = useState<SevenoUser | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [assessmentSummary, setAssessmentSummary] = useState<CandidateAssessmentSummary | null>(null);
  const [applications, setApplications] = useState<SerializedCandidateJobApplication[]>([]);
  const [availabilityAction, setAvailabilityAction] = useState<
    'confirm_yes' | 'confirm_no' | 'declare_immediate' | 'enable_notifications' | 'disable_notifications' | null
  >(null);
  const [availabilityNotice, setAvailabilityNotice] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCandidateDashboard() {
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

        if (sevenoUser.role !== 'candidate') {
          router.replace(resolveSevenoRedirect(sevenoUser));
          return;
        }

        const [candidateProfile, assessmentResponse] = await Promise.all([
          getCandidateProfile(sevenoUser.uid),
          authUser.getIdToken().then((token) => fetch('/api/seveno/tests/start', {
            headers: { Authorization: `Bearer ${token}` },
          })),
        ]);
        if (!active) {
          return;
        }

        const assessmentPayload = assessmentResponse.ok
          ? await assessmentResponse.json() as { assessment?: CandidateAssessmentSummary | null }
          : { assessment: null };

        let candidateApplications: SerializedCandidateJobApplication[] = [];
        try {
          const payload = await listApplicationsClient(authUser);
          candidateApplications = payload.applications ?? [];
        } catch {
          candidateApplications = [];
        }

        if (!active) {
          return;
        }

        setUser(sevenoUser);
        setAuthUser(authUser);
        setProfile(candidateProfile);
        setAssessmentSummary(assessmentPayload.assessment ?? null);
        setApplications(candidateApplications);
        setLoading(false);
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : "L'espace candidat n'a pas pu être chargé.");
        setLoading(false);
      }
    }

    void loadCandidateDashboard();

    return () => {
      active = false;
    };
  }, [router]);

  const sectorLabel = profile ? findSectorLabel(profile.sectorId) ?? profile.sectorId : null;
  const familyLabel = profile ? findFamilyLabel(profile.jobFamilyId) ?? profile.jobFamilyId : null;
  const roleLabel = profile ? findRoleLabel(profile.jobRoleId) ?? profile.jobRoleId : null;
  const invitationApplications = applications.filter((item) => item.origin === 'company' && item.status === 'invited');
  const invitationCount = invitationApplications.length;
  const acceptedRelationsCount = applications.filter((item) => item.conversationStatus === 'open').length;
  const draftApplicationsCount = applications.filter((item) => ['draft', 'prerequisites_in_progress', 'eligible', 'ineligible'].includes(item.status)).length;
  const submittedApplicationsCount = applications.filter((item) => item.status === 'submitted').length;
  const withdrawnApplicationsCount = applications.filter((item) => item.status === 'withdrawn').length;
  const profileComplete = profile ? isCandidateProfileComplete(profile) : false;
  const assessmentCompleted = profile ? hasCompletedSevenoAssessment(profile) : assessmentSummary?.status === 'completed';
  const assessmentScore = profile?.sevenoAssessmentOverallScore ?? assessmentSummary?.overallScore ?? null;
  const targetJobs = profile
    ? Array.isArray(profile.targetJobs) && profile.targetJobs.length > 0
      ? profile.targetJobs
      : [{
          sectorId: profile.sectorId,
          jobFamilyId: profile.jobFamilyId,
          jobRoleId: profile.jobRoleId,
          label: roleLabel ?? profile.jobRoleId,
        }]
    : [];
  const privateFullName = [user?.firstName?.trim(), user?.lastName?.trim()].filter(Boolean).join(' ');
  const displayName = privateFullName || user?.displayName?.trim() || "Candidat Seven'O";
  const identityComplete = user ? isCandidateIdentityComplete(user) : false;
  const identityLocation = [user?.postalCode?.trim(), user?.city?.trim()].filter(Boolean).join(' ');
  const profileCompletenessLabel = profileComplete ? 'Profil complet' : 'Profil incomplet';
  const profileStatusLabel = profile ? formatPublicStatusLabel(profile.profileStatus) : 'Brouillon';
  const testStateLabel = assessmentCompleted ? "Questionnaire Seven'O terminé" : "Questionnaire Seven'O à compléter";
  const availabilityView = profile ? getCandidateAvailabilityView(profile) : null;
  const availabilityNotificationsEnabled = profile?.dailyAvailabilityConfirmationEnabled === true;
  const profileActivationAction = profile && profileComplete && profile.profileStatus === 'draft'
    ? {
        href: '/candidat/onboarding',
        label: 'Activer mon profil',
      }
    : null;
  const showAssessmentCallout = profile ? !assessmentCompleted : false;

  async function handleAvailabilityConfirmation(action: 'confirm_yes' | 'confirm_no' | 'declare_immediate') {
    if (!authUser || !profile || !user) {
      return;
    }

    setAvailabilityAction(action);
    setAvailabilityError(null);
    setAvailabilityNotice(null);

    try {
      const result = await confirmCandidateAvailabilityFromDashboard(authUser, {
        action: action === 'confirm_no' ? 'no' : action === 'declare_immediate' ? 'immediate' : 'yes',
        source: 'dashboard',
      });
      setProfile(result.profile ?? await getCandidateProfile(user.uid));
      setAvailabilityNotice(
        action === 'confirm_no'
          ? 'Disponibilite immediate desactivee.'
          : action === 'declare_immediate'
            ? 'Vous etes maintenant declare disponible immediatement.'
            : 'Disponibilite confirmee pour 24 heures.',
      );
    } catch (thrownError) {
      setAvailabilityError(thrownError instanceof Error ? thrownError.message : 'La confirmation a echoue.');
    } finally {
      setAvailabilityAction(null);
    }
  }

  async function handleAvailabilityNotifications(action: 'enable_notifications' | 'disable_notifications') {
    if (!authUser || !profile || !user) {
      return;
    }

    setAvailabilityAction(action);
    setAvailabilityError(null);
    setAvailabilityNotice(null);

    try {
      if (action === 'disable_notifications') {
        const result = await updateCandidateAvailabilityNotifications(authUser, {
          action: 'disable',
          source: 'dashboard',
        });
        setProfile(result.profile ?? await getCandidateProfile(user.uid));
        setAvailabilityNotice('Les confirmations quotidiennes sont desactivees.');
        return;
      }

      const support = await requestCandidateAvailabilityPushToken();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
      if (support.permission === 'granted' && support.token) {
        await registerCandidateAvailabilityDevice(authUser, {
          deviceId: support.deviceId,
          token: support.token,
          permission: support.permission,
          timezone,
          platform: navigator.platform,
          userAgent: navigator.userAgent,
          source: 'dashboard',
        });
      }

      const result = await updateCandidateAvailabilityNotifications(authUser, {
        action: 'enable',
        source: 'dashboard',
        permission: support.permission,
      });
      setProfile(result.profile ?? await getCandidateProfile(user.uid));
      setAvailabilityNotice(
        support.permission === 'granted'
          ? 'Les confirmations quotidiennes sont actives sur cet appareil.'
          : 'Les confirmations quotidiennes sont actives, mais les notifications push ne sont pas disponibles. Vous pourrez confirmer depuis le tableau de bord.',
      );
    } catch (thrownError) {
      setAvailabilityError(thrownError instanceof Error ? thrownError.message : 'La configuration des notifications a echoue.');
    } finally {
      setAvailabilityAction(null);
    }
  }

  const summaryCards: CandidateSummaryCard[] = profile
    ? [
        {
          tone: 'cyan',
          label: "Indice Seven'O",
          value: assessmentCompleted && assessmentScore != null ? `${Math.round(assessmentScore)}%` : 'En attente',
          note: assessmentCompleted
            ? 'Synthèse générale calculée côté serveur, indépendante de vos métiers.'
            : "Répondez au questionnaire général Seven'O.",
        },
        {
          tone: 'orange',
          label: 'Statut du profil',
          value: profileStatusLabel,
          note:
            !profileComplete
              ? 'Le profil doit encore être complété.'
              : profile.profileStatus === 'active'
              ? 'Votre profil est visible côté entreprise via la version anonyme.'
              : profile.profileStatus === 'paused'
                ? 'Le profil est mis en pause pour le moment.'
                : 'Le profil est encore en brouillon.',
          action: profileActivationAction ? (
            <Link
              href={profileActivationAction.href}
              className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
            >
              {profileActivationAction.label}
            </Link>
          ) : undefined,
        },
        {
          tone: 'neutral',
          label: 'Invitations reçues',
          value: String(invitationCount),
          note:
            invitationCount > 0
              ? `${invitationCount} invitation(s) attendent votre décision.`
              : 'Aucune invitation en attente pour le moment.',
          action: (
            <Link
              href="/candidat/demandes"
              className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Ouvrir mes demandes
            </Link>
          ),
        },
        {
          tone: 'cyan',
          label: 'Mes métiers recherchés',
          value: `${targetJobs.length}/3`,
          note: targetJobs.map((job) => job.label).join(', '),
          action: (
            <Link
              href="/candidat/onboarding"
              className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
            >
              {targetJobs.length < 3 ? 'Ajouter un métier recherché' : 'Modifier mes métiers'}
            </Link>
          ),
        },
      ]
    : [];

  const opportunityCards: CandidateSummaryCard[] = profile
    ? [
        {
          tone: 'violet',
          label: 'Offres pour mes métiers',
          value: 'Disponibles',
          note: 'Consultez uniquement les offres publiées correspondant à vos métiers recherchés.',
          action: (
            <Link
              href="/candidat/offres"
              className="inline-flex rounded-full border border-violet-300/20 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/15"
            >
              Voir les offres
            </Link>
          ),
        },
        {
          tone: 'neutral',
          label: 'Mes candidatures',
          value: String(applications.length),
          note: `${draftApplicationsCount} en cours, ${submittedApplicationsCount} envoyée(s), ${withdrawnApplicationsCount} retirée(s).`,
          action: (
            <Link
              href="/candidat/candidatures"
              className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Ouvrir mes candidatures
            </Link>
          ),
        },
      ]
    : [];

  const progress = profile
    ? getProgressState(profile, invitationCount, acceptedRelationsCount, profileComplete, assessmentCompleted)
    : null;
  const profileAction = profile ? getProfileAction(profile, profileComplete) : null;

  return (
    <CandidateShell
      title="Votre espace candidat"
      description="Retrouvez votre identité privée, votre profil métier et les prochaines étapes de votre parcours Seven'O."
      actions={(
        <div className="flex items-start justify-end">
          <Image
            src="/images/icone-tdb-seveno-transparent.png"
            alt=""
            width={1254}
            height={1254}
            priority
            aria-hidden="true"
            className="block h-auto w-[92px] shrink-0 sm:w-[110px] lg:w-[130px] xl:w-[146px]"
          />
        </div>
      )}
      footer={user ? <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Session candidat</p> : null}
    >
      {loading ? (
        <SevenoPanel tone="neutral" className="px-4 py-4 text-sm text-slate-300">
          Chargement du profil candidat...
        </SevenoPanel>
      ) : error ? (
        <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">{error}</SevenoPanel>
      ) : profile && progress && profileAction ? (
        <div className="space-y-6">
          <SevenoPanel tone="cyan" className="p-5">
            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-8">
              <div className="max-w-none">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Bonjour</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {displayName}, pilotez votre profil Seven&apos;O.
                </h2>
                <div className="mt-5 grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
                  <p>
                    <span className="text-slate-500">Téléphone :</span> {user?.phone ?? 'Non renseigné'}
                  </p>
                  <p>
                    <span className="text-slate-500">Ville :</span> {identityLocation || 'Non renseignée'}
                  </p>
                  <p>
                    <span className="text-slate-500">Complétude :</span>{' '}
                    {identityComplete ? 'Identité complète' : 'Identité incomplète'}
                  </p>
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                  Vos informations personnelles restent invisibles aux entreprises tant que vous n&apos;avez pas accepté
                  une mise en relation. Vous les voyez ici parce que cet espace est privé et réservé à votre compte.
                </p>

                <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {profile.publicCandidateId}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {targetJobs.length} / 3 métier(s)
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {sectorLabel ?? 'Secteur non renseigné'}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {familyLabel ?? 'Famille non renseignée'}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {formatExperienceLabel(profile.experienceLevel)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {formatAvailabilityLabel(profile.availability)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {profile.locationArea}
                  </span>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">
                    {formatPublicStatusLabel(profile.profileStatus)}
                  </span>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={profileAction.href}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:brightness-110"
                  >
                    {profileAction.label}
                  </Link>
                  <Link
                    href="/candidat/identite"
                    className="inline-flex items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                  >
                    {identityComplete ? 'Modifier mon identité' : 'Compléter mon identité'}
                  </Link>
                </div>
              </div>

              <div className="space-y-3 lg:min-w-0 lg:flex-1">
                <article className="h-full rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">Récapitulatif anonyme</p>
                  <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                    <p><span className="text-slate-500">Identifiant public :</span> {profile.publicCandidateId}</p>
                    <p><span className="text-slate-500">Métiers :</span> {targetJobs.map((job) => job.label).join(', ')}</p>
                    <p><span className="text-slate-500">Profil :</span> {profileCompletenessLabel}</p>
                    <p><span className="text-slate-500">Statut :</span> {profileStatusLabel}</p>
                    <p className="sm:col-span-2"><span className="text-slate-500">Évaluation :</span> {testStateLabel}</p>
                  </div>
                </article>
              </div>
            </div>
          </SevenoPanel>

          <SevenoPanel tone="neutral" className="p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Disponibilite</p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {availabilityView?.label ?? 'Disponibilite a confirmer'}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {availabilityView?.detail ?? 'Confirmez votre disponibilite immediatement pour rester visible dans la recherche entreprise.'}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    Derniere confirmation : {formatDateTime(profile?.availabilityConfirmedAt ?? null)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    Expiration : {formatDateTime(profile?.availabilityValidUntil ?? null)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    Prochaine relance : {formatDateTime(profile?.nextAvailabilityReminderAt ?? null)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    Notifications : {availabilityNotificationsEnabled ? 'Actives' : 'Desactivees'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300 lg:min-w-[18rem]">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Etat candidat</p>
                <p className="font-medium text-white">
                  {availabilityView?.state === 'available_now'
                    ? 'Disponible immediatement'
                    : availabilityView?.state === 'confirmation_required'
                      ? 'Disponibilite a confirmer'
                      : availabilityView?.state === 'available_from_date'
                        ? 'Disponible a une date future'
                        : 'Non disponible'}
                </p>
                <p>Visible entreprise : {availabilityView?.isConfirmedNow ? 'Oui' : 'Non'}</p>
                <p>Etat notifications : {availabilityNotificationsEnabled ? 'Confirmations quotidiennes actives' : 'Confirmations quotidiennes desactivees'}</p>
              </div>
            </div>

            {availabilityNotice ? (
              <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
                {availabilityNotice}
              </div>
            ) : null}

            {availabilityError ? (
              <div className="mt-4 rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {availabilityError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              {(availabilityView?.state === 'available_now' || availabilityView?.state === 'confirmation_required') ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleAvailabilityConfirmation('confirm_yes')}
                    disabled={availabilityAction !== null}
                    className="inline-flex rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {availabilityAction === 'confirm_yes' ? 'Validation...' : 'Oui, toujours disponible'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAvailabilityConfirmation('confirm_no')}
                    disabled={availabilityAction !== null}
                    className="inline-flex rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {availabilityAction === 'confirm_no' ? 'Mise a jour...' : 'Non, plus disponible'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleAvailabilityConfirmation('declare_immediate')}
                  disabled={availabilityAction !== null}
                  className="inline-flex rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {availabilityAction === 'declare_immediate'
                    ? 'Activation...'
                    : 'Me declarer disponible immediatement'}
                </button>
              )}

              <button
                type="button"
                onClick={() => void handleAvailabilityNotifications(availabilityNotificationsEnabled ? 'disable_notifications' : 'enable_notifications')}
                disabled={availabilityAction !== null}
                className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {availabilityAction === 'enable_notifications' || availabilityAction === 'disable_notifications'
                  ? 'Mise a jour...'
                  : availabilityNotificationsEnabled
                    ? 'Desactiver les notifications'
                    : 'Activer les confirmations quotidiennes'}
              </button>
            </div>
          </SevenoPanel>

          <CandidateProgress steps={progress.steps} />

          {showAssessmentCallout ? (
            <SevenoPanel tone="violet" className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Évaluation Seven&apos;O</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Questionnaire général en attente</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    Votre questionnaire Seven&apos;O n&apos;est pas encore terminé. Lancez-le quand vous êtes prêt pour actualiser
                    votre indice et votre statut d&apos;évaluation.
                  </p>
                </div>

                <Link
                  href="/candidat/test"
                  className="inline-flex items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                >
                  Répondre au questionnaire Seven&apos;O
                </Link>
              </div>
            </SevenoPanel>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <CandidateStatusCard
                key={card.label}
                tone={card.tone}
                label={card.label}
                value={card.value}
                note={card.note}
                action={card.action}
              />
            ))}
          </div>

          <SevenoPanel tone="violet" className="p-5">
            <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Visibilité et confidentialité</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Ce que vous gardez privé</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Vos informations personnelles restent invisibles aux entreprises tant que vous n&apos;avez pas accepté une mise en relation.
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Les coordonnées restent bloquées avant acceptation. La projection entreprise n&apos;affiche que les éléments anonymes utiles
                  à la recherche et à la décision.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Profil visible</p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {profile.profileStatus === 'active' ? 'Oui' : 'Non'}
                  </p>
                </article>
                <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Indice Seven&apos;O</p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {assessmentCompleted && assessmentScore != null ? `${Math.round(assessmentScore)}%` : 'En attente'}
                  </p>
                </article>
                <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Coordonnées privées</p>
                  <p className="mt-2 text-sm font-medium text-white">Bloquées tant que vous n&apos;avez pas accepté.</p>
                </article>
              </div>
            </div>
          </SevenoPanel>

          <div className="grid gap-4 md:grid-cols-2">
            {opportunityCards.map((card) => (
              <CandidateStatusCard
                key={card.label}
                tone={card.tone}
                label={card.label}
                value={card.value}
                note={card.note}
                action={card.action}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <SevenoPanel tone="cyan" className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Votre parcours</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Construisez votre profil Seven&apos;O</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Votre identité reste privée. Terminez le questionnaire général, puis choisissez jusqu&apos;à trois métiers recherchés.
            </p>
          </SevenoPanel>

          <SevenoPanel tone="neutral" className="p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Disponibilite</p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {availabilityView?.label ?? 'Disponibilite a confirmer'}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {availabilityView?.detail ?? 'Confirmez votre disponibilite immediatement pour rester visible dans la recherche entreprise.'}
                </p>
              </div>

              <div className="space-y-2 rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300 lg:min-w-[18rem]">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Etat candidat</p>
                <p className="font-medium text-white">
                  {availabilityView?.state === 'available_now'
                    ? 'Disponible immediatement'
                    : availabilityView?.state === 'confirmation_required'
                      ? 'Disponibilite a confirmer'
                      : availabilityView?.state === 'available_from_date'
                        ? 'Disponible a une date future'
                        : 'Non disponible'}
                </p>
                <p>Notifications quotidiennes : {availabilityNotificationsEnabled ? 'Actives' : 'Desactivees'}</p>
              </div>
            </div>

            {availabilityNotice ? (
              <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
                {availabilityNotice}
              </div>
            ) : null}

            {availabilityError ? (
              <div className="mt-4 rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {availabilityError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              {(availabilityView?.state === 'available_now' || availabilityView?.state === 'confirmation_required') ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleAvailabilityConfirmation('confirm_yes')}
                    disabled={availabilityAction !== null}
                    className="inline-flex rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {availabilityAction === 'confirm_yes' ? 'Validation...' : 'Oui, toujours disponible'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAvailabilityConfirmation('confirm_no')}
                    disabled={availabilityAction !== null}
                    className="inline-flex rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {availabilityAction === 'confirm_no' ? 'Mise a jour...' : 'Non, plus disponible'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleAvailabilityConfirmation('declare_immediate')}
                  disabled={availabilityAction !== null}
                  className="inline-flex rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {availabilityAction === 'declare_immediate'
                    ? 'Activation...'
                    : 'Me declarer disponible immediatement'}
                </button>
              )}

              <button
                type="button"
                onClick={() => void handleAvailabilityNotifications(availabilityNotificationsEnabled ? 'disable_notifications' : 'enable_notifications')}
                disabled={availabilityAction !== null}
                className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {availabilityAction === 'enable_notifications' || availabilityAction === 'disable_notifications'
                  ? 'Mise a jour...'
                  : availabilityNotificationsEnabled
                    ? 'Desactiver les notifications'
                    : 'Activer les confirmations quotidiennes'}
              </button>
            </div>
          </SevenoPanel>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <CandidateStatusCard
              tone="cyan"
              label="Mon identité privée"
              value={identityComplete ? 'Complète' : 'À compléter'}
              note="Nom, email et téléphone ne sont jamais exposés aux entreprises."
              action={<Link href="/candidat/identite" className="text-sm font-semibold text-cyan-100">{identityComplete ? 'Modifier mon identité' : 'Compléter mon identité'}</Link>}
            />
            <CandidateStatusCard
              tone="violet"
              label="Mon évaluation Seven'O"
              value={assessmentCompleted && assessmentScore != null ? `${Math.round(assessmentScore)}%` : 'À réaliser'}
              note="Questionnaire général indépendant de tout métier et de toute entreprise."
              action={<Link href="/candidat/test" className="text-sm font-semibold text-cyan-100">{assessmentCompleted ? "Revoir mon évaluation Seven'O" : "Répondre au questionnaire Seven'O"}</Link>}
            />
            <CandidateStatusCard
              tone="orange"
              label="Mes métiers recherchés"
              value="0/3"
              note="Sélectionnez entre un et trois métiers issus de la taxonomie Seven'O."
              action={<Link href="/candidat/onboarding" className="text-sm font-semibold text-cyan-100">Ajouter un métier recherché</Link>}
            />
            <CandidateStatusCard
              tone="neutral"
              label="Mon profil anonyme"
              value="Brouillon"
              note="Il pourra être activé après complétion des étapes obligatoires."
              action={<Link href="/candidat/onboarding" className="text-sm font-semibold text-cyan-100">Compléter mon profil</Link>}
            />
          </div>
        </div>
      )}
    </CandidateShell>
  );
}
