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
import { ensureSevenoUser, hasSevenoTermsAcceptance, resolveSevenoRedirect } from '@/lib/seveno-users';
import { CandidateProgress, type CandidateProgressState } from '@/components/candidate/CandidateProgress';
import { CandidateShell } from '@/components/candidate/CandidateShell';
import { CandidateStatusCard } from '@/components/candidate/CandidateStatusCard';
import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import {
  confirmCandidateAvailabilityFromDashboard,
  registerCandidateAvailabilityDevice,
  requestCandidateAvailabilityPushToken,
  sendCandidateAvailabilityTestNotification,
  updateCandidateAvailabilityNotifications,
} from '@/lib/seveno-candidate-availability-client';
import {
  getCandidateAvailabilityView,
  isProfileVisibleToCompanies as isCandidateProfileVisibleToCompanies,
} from '@/lib/seveno-candidate-availability';
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

function getProgressState(
  profile: CandidateProfile,
  profileComplete: boolean,
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

type AvailabilityPushSupport = Awaited<ReturnType<typeof requestCandidateAvailabilityPushToken>>;

function logCandidateAvailabilityDebug(step: string, details?: Record<string, unknown>) {
  console.info('[SevenO availability test]', {
    step,
    ...details,
  });
}

function getAvailabilityTestFailureMessage(
  support: AvailabilityPushSupport | null,
  hasActiveDevice: boolean | null,
  serverError: unknown = null,
) {
  if (!support) {
    return 'Impossible de vérifier les notifications.';
  }

  if (!support.supported) {
    return 'Ce navigateur ne prend pas en charge les notifications.';
  }

  if (!support.serviceWorkerRegistration || !support.serviceWorkerRegistration.active) {
    return 'Le service de notifications n’est pas encore actif.';
  }

  if (support.permission !== 'granted') {
    return 'Les notifications ne sont pas autorisées dans Chrome.';
  }

  if (!support.token) {
    if (support.vapidKeyPresent === false) {
      return 'La clé VAPID Firebase est manquante.';
    }

    return 'Impossible de créer l’abonnement Firebase.';
  }

  if (hasActiveDevice === false) {
    return 'Cet appareil n’est pas enregistré.';
  }

  if (serverError) {
    return 'L’envoi de test a échoué côté serveur.';
  }

  return 'La notification de test a échoué.';
}

export default function CandidateDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [user, setUser] = useState<SevenoUser | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [availabilityAction, setAvailabilityAction] = useState<
    'confirm_yes' | 'confirm_no' | 'declare_immediate' | 'enable_notifications' | 'disable_notifications' | 'send_test_notification' | null
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

        const sevenoUser = await ensureSevenoUser(authUser, null);
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

        const hasCandidateAccountAcceptance = hasSevenoTermsAcceptance(sevenoUser, 'candidate_account');
        if (sevenoUser.onboardingCompleted && !hasCandidateAccountAcceptance) {
          router.replace('/cgu');
          return;
        }

        const candidateProfile = await getCandidateProfile(sevenoUser.uid);
        if (!active) {
          return;
        }

        setUser(sevenoUser);
        setAuthUser(authUser);
        setProfile(candidateProfile);
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
  const profileComplete = profile ? isCandidateProfileComplete(profile) : false;
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
  const questionnaireStatus = profile?.sevenoAssessmentStatus ?? 'not_started';
  const questionnaireCompleted = questionnaireStatus === 'completed';
  const questionnaireInProgress = questionnaireStatus === 'in_progress';
  const questionnaireStateLabel = questionnaireCompleted
    ? 'Terminé'
    : questionnaireInProgress
      ? 'Session en cours'
      : 'À démarrer';
  const questionnaireStateNote = questionnaireCompleted
    ? 'Votre analyse professionnelle Seven’O est enregistrée. Vous pouvez consulter le récapitulatif et les résultats.'
    : questionnaireInProgress
      ? 'Une session chronométrée est déjà active. Ouvrez la page du questionnaire pour continuer.'
      : 'Lancez la session réelle depuis votre tableau de bord quand vous êtes prêt.';
  const questionnaireActionLabel = questionnaireCompleted
    ? 'Voir mon résultat'
    : questionnaireInProgress
      ? 'Continuer la session'
      : 'Commencer le questionnaire';
  const testStateLabel = questionnaireStateLabel;
  const availabilityView = profile ? getCandidateAvailabilityView(profile) : null;
  const profileVisibleToCompanies = profile
    ? isCandidateProfileVisibleToCompanies(profile) && profileComplete
    : false;
  const immediateAvailabilityConfirmed = availabilityView?.isImmediateAvailabilityConfirmed ?? false;
  const availabilityNotificationsEnabled = profile?.dailyAvailabilityConfirmationEnabled === true;
  const profileActivationAction = profile && profileComplete && profile.profileStatus === 'draft'
    ? {
        href: '/candidat/onboarding',
        label: 'Activer mon profil',
      }
    : null;
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
          ? 'Disponibilité immédiate désactivée.'
          : action === 'declare_immediate'
            ? 'Vous êtes maintenant déclaré disponible immédiatement.'
            : 'Disponibilité confirmée pour 24 heures.',
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

    logCandidateAvailabilityDebug('activation_click', {
      action,
    });
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
        setAvailabilityNotice('Les confirmations quotidiennes sont désactivées.');
        return;
      }

      const support = await requestCandidateAvailabilityPushToken();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
      if (support.permission === 'granted' && support.token) {
        try {
          await registerCandidateAvailabilityDevice(authUser, {
            deviceId: support.deviceId,
            token: support.token,
            permission: support.permission,
            timezone,
            platform: navigator.platform,
            userAgent: navigator.userAgent,
            source: 'dashboard',
          });
          logCandidateAvailabilityDebug('register_device_success', {
            action,
            deviceId: support.deviceId,
            permission: support.permission,
          });
        } catch (error) {
          logCandidateAvailabilityDebug('register_device_failed', {
            action,
            deviceId: support.deviceId,
            permission: support.permission,
            message: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
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

  async function handleSendAvailabilityTestNotification() {
    if (!authUser || !profile || !user) {
      setAvailabilityError('Le profil candidat n’est pas encore chargé.');
      return;
    }

    logCandidateAvailabilityDebug('activation_click', {
      action: 'send_test_notification',
    });
    setAvailabilityAction('send_test_notification');
    setAvailabilityError(null);
    setAvailabilityNotice(null);

    let support: AvailabilityPushSupport | null = null;
    let hasActiveDevice: boolean | null = null;

    try {
      support = await requestCandidateAvailabilityPushToken();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;

      if (!support.serviceWorkerRegistration) {
        throw new Error('Le service de notifications n’est pas encore actif.');
      }

      if (support.permission !== 'granted') {
        throw new Error('Les notifications ne sont pas autorisées dans Chrome.');
      }

      if (!support.token) {
        throw new Error('Impossible de créer l’abonnement Firebase.');
      }

      let registrationResult: Awaited<ReturnType<typeof registerCandidateAvailabilityDevice>>;
      try {
        registrationResult = await registerCandidateAvailabilityDevice(authUser, {
          deviceId: support.deviceId,
          token: support.token,
          permission: support.permission,
          timezone,
          platform: navigator.platform,
          userAgent: navigator.userAgent,
          source: 'dashboard',
        });
        logCandidateAvailabilityDebug('register_device_success', {
          action: 'send_test_notification',
          deviceId: support.deviceId,
          permission: support.permission,
          hasActiveDevice: registrationResult.hasActiveDevice,
        });
      } catch (error) {
        logCandidateAvailabilityDebug('register_device_failed', {
          action: 'send_test_notification',
          deviceId: support.deviceId,
          permission: support.permission,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
      hasActiveDevice = registrationResult.hasActiveDevice;

      if (!registrationResult.hasActiveDevice) {
        throw new Error('Cet appareil n’est pas enregistré.');
      }

      const result = await sendCandidateAvailabilityTestNotification(authUser, {
        source: 'dashboard',
      });

      setProfile(result.profile ?? await getCandidateProfile(user.uid));
      setAvailabilityNotice(
        `Permission Chrome : ${support.permission}. Service worker : OK. Token FCM : ${support.token ? 'present' : 'absent'}. Appareil actif : ${registrationResult.hasActiveDevice ? 'oui' : 'non'}. Notification de test : ${result.sent > 0 ? 'envoyee' : 'non envoyee'}.`,
      );
    } catch (thrownError) {
      setAvailabilityError(
        thrownError instanceof Error && thrownError.message.trim().length > 0
          ? thrownError.message
          : getAvailabilityTestFailureMessage(support, hasActiveDevice, thrownError),
      );
    } finally {
      setAvailabilityAction(null);
    }
  }

  void availabilityAction;
  void availabilityNotice;
  void availabilityError;
  void handleAvailabilityConfirmation;
  void handleAvailabilityNotifications;
  void handleSendAvailabilityTestNotification;
  const recommendationVerifiedCount = profile?.recommendationVerifiedCount ?? 0;
  const summaryCards: CandidateSummaryCard[] = profile
    ? [
        {
          tone: 'orange',
          label: 'Statut du profil',
          value: profileStatusLabel,
          note:
            !profileComplete
              ? 'Le profil doit encore être complété.'
              : profile.profileStatus === 'active'
              ? "Votre profil est prêt pour l'ouverture complète."
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
          tone: 'cyan',
          label: 'Métiers ciblés',
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
        {
          tone: 'neutral',
          label: 'Présentation professionnelle',
          value: profile?.professionalSelfDescription?.trim() ? 'Renseignée' : 'À compléter',
          note: profile?.professionalSelfDescription?.trim()
            ? profile.professionalSelfDescription.trim()
            : 'Présentez ici votre parcours, votre manière de travailler et ce que vous apportez.',
          action: (
            <Link
              href="/candidat/onboarding#presentation"
              className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Compléter ma présentation
            </Link>
          ),
        },
        {
          tone: 'violet',
          label: 'Recommandations',
          value: String(recommendationVerifiedCount),
          note:
            recommendationVerifiedCount > 0
              ? `${recommendationVerifiedCount} recommandation(s) vérifiée(s) déjà disponible(s).`
              : 'Demandez à d anciens employeurs de partager un avis.',
          action: (
            <Link
              href="/candidat/recommandations"
              className="inline-flex rounded-full border border-violet-300/20 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/15"
            >
              Gérer mes recommandations
            </Link>
          ),
        },
      ]
    : [];

  const opportunityCards: CandidateSummaryCard[] = profile
    ? [
        {
          tone: 'violet',
          label: 'Questionnaire général Seven’O',
          value: questionnaireStateLabel,
          note: questionnaireStateNote,
          action: (
            <Link
              href="/candidat/test"
              className="inline-flex rounded-full border border-violet-300/20 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/15"
            >
              {questionnaireActionLabel}
            </Link>
          ),
        },
        {
          tone: 'cyan',
          label: 'Disponibilité quotidienne',
          value: availabilityNotificationsEnabled ? 'Confirmations actives' : 'À gérer',
          note: immediateAvailabilityConfirmed
            ? 'Votre disponibilité immédiate est confirmée et visible selon vos règles de profil.'
            : 'Déclarez ou confirmez votre disponibilité depuis le bloc dédié.',
          action: (
            <Link
              href="#disponibilite"
              className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
            >
              Gérer ma disponibilité
            </Link>
          ),
        },
      ]
    : [];

  const progress = profile
    ? getProgressState(profile, profileComplete)
    : null;
  const profileAction = profile ? getProfileAction(profile, profileComplete) : null;
  const recommendationInvitationCount = profile?.recommendationInvitationCount ?? 0;
  const recommendationVerificationPendingCount = profile?.recommendationVerificationPendingCount ?? 0;
  const recommendationVerifiedCountLater = profile?.recommendationVerifiedCount ?? 0;
  const recommendationVisibleCount = profile?.recommendationVisibleCount ?? 0;
  const professionalSelfDescription = profile?.professionalSelfDescription?.trim() || 'Présentez ici votre parcours, votre manière de travailler et ce que vous apportez.';
  const professionalReputationDescription = profile?.professionalReputationDescription?.trim() || 'Décrivez ce que vos anciens collègues, managers ou clients disent de votre façon de travailler.';

  return (
    <CandidateShell
      title="Votre espace candidat"
      description="Retrouvez votre identité privée, votre profil métier et les prochaines étapes de votre parcours Seven’O."
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
                  {displayName}, pilotez votre profil Seven’O.
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
                  <Link
                    href="/candidat/recommandations"
                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    Mes recommandations
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
                    <p className="sm:col-span-2"><span className="text-slate-500">Lancement :</span> {testStateLabel}</p>
                  </div>
                </article>
              </div>
            </div>
          </SevenoPanel>

          <SevenoPanel tone="neutral" className="p-5" id="disponibilite">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Disponibilité</p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {availabilityView?.label ?? 'Disponibilité à confirmer'}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {availabilityView?.detail ?? 'Confirmez votre disponibilité immédiate pour apparaître dans le filtre dédié.'}
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
                    ? 'Disponible immédiatement'
                    : availabilityView?.state === 'confirmation_required'
                      ? 'Disponibilité à confirmer'
                      : availabilityView?.state === 'available_from_date'
                        ? 'Disponible a une date future'
                        : 'Non disponible'}
                </p>
                <p>Visibilité entreprise : {profileVisibleToCompanies ? 'Oui' : 'Non'}</p>
                <p>Disponibilité immédiate : {immediateAvailabilityConfirmed ? 'Confirmée' : 'À confirmer'}</p>
                <p>État notifications : {availabilityNotificationsEnabled ? 'Confirmations quotidiennes actives' : 'Confirmations quotidiennes désactivées'}</p>
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
              <button
                type="button"
                onClick={() => void handleAvailabilityConfirmation('confirm_yes')}
                disabled={availabilityAction !== null}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Confirmer ma disponibilité 24 h
              </button>
              <button
                type="button"
                onClick={() => void handleAvailabilityConfirmation('declare_immediate')}
                disabled={availabilityAction !== null}
                className="inline-flex items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Me déclarer disponible immédiatement
              </button>
              <button
                type="button"
                onClick={() => void handleAvailabilityConfirmation('confirm_no')}
                disabled={availabilityAction !== null}
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Je ne suis plus disponible
              </button>
              <button
                type="button"
                onClick={() => void handleAvailabilityNotifications(
                  availabilityNotificationsEnabled ? 'disable_notifications' : 'enable_notifications',
                )}
                disabled={availabilityAction !== null}
                className="inline-flex items-center justify-center rounded-full border border-violet-300/20 bg-violet-400/10 px-5 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/15 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {availabilityNotificationsEnabled
                  ? 'Désactiver les confirmations quotidiennes'
                  : 'Activer les confirmations quotidiennes'}
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-7 text-slate-300">
              Vous pouvez gérer ici votre disponibilité réelle sans quitter le tableau de bord. Les confirmations quotidiennes restent
              disponibles à tout moment.
            </div>
          </SevenoPanel>

          <CandidateProgress steps={progress.steps} />

          <SevenoPanel tone="violet" className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Questionnaire général Seven’O</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Lancer votre session réelle et chronométrée</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Le bouton du tableau de bord ouvre votre session réelle sur <Link href="/candidat/test" className="text-cyan-200 transition hover:text-cyan-100">/candidat/test</Link>.
                  Une session active se recharge telle quelle, sans créer un nouveau parcours.
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <Link
                  href="/candidat/test"
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:brightness-110"
                >
                  {questionnaireActionLabel}
                </Link>
              </div>
            </div>
          </SevenoPanel>

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

          <SevenoPanel tone="neutral" className="p-5">
            <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Présentation professionnelle</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Votre récit professionnel et vos recommandations</h2>
                <div className="mt-4 grid gap-3">
                  <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Ce que vous diriez de vous</p>
                    <p className="mt-2 text-sm leading-7 text-slate-200">{professionalSelfDescription}</p>
                  </article>
                  <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Ce que les autres disent de vous</p>
                    <p className="mt-2 text-sm leading-7 text-slate-200">{professionalReputationDescription}</p>
                  </article>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/candidat/onboarding#presentation"
                    className="inline-flex items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                  >
                    Compléter ma présentation
                  </Link>
                  <Link
                    href="/candidat/recommandations"
                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    Gérer mes recommandations
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Invitations</p>
                  <p className="mt-2 text-sm font-medium text-white">{recommendationInvitationCount}</p>
                </article>
                <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">En vérification</p>
                  <p className="mt-2 text-sm font-medium text-white">{recommendationVerificationPendingCount}</p>
                </article>
                <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Visibles aux entreprises</p>
                  <p className="mt-2 text-sm font-medium text-white">{recommendationVisibleCount}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {recommendationVerifiedCountLater} recommandation(s) vérifiée(s) au total.
                  </p>
                </article>
              </div>
            </div>
          </SevenoPanel>

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
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Questionnaire général Seven’O</p>
                  <p className="mt-2 text-sm font-medium text-white">{questionnaireStateLabel}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {questionnaireStateNote}
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
            <h2 className="mt-2 text-2xl font-semibold text-white">Construisez votre profil Seven’O</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Votre identité reste privée. Terminez le questionnaire général, puis choisissez jusqu&apos;à trois métiers recherchés.
            </p>
          </SevenoPanel>

          <SevenoPanel tone="neutral" className="p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Disponibilité</p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {availabilityView?.label ?? 'Disponibilité à confirmer'}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {availabilityView?.detail ?? 'Confirmez votre disponibilité immédiate pour apparaître dans le filtre dédié.'}
                </p>
              </div>

              <div className="space-y-2 rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300 lg:min-w-[18rem]">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Etat candidat</p>
                <p className="font-medium text-white">
                  {availabilityView?.state === 'available_now'
                    ? 'Disponible immédiatement'
                    : availabilityView?.state === 'confirmation_required'
                      ? 'Disponibilité à confirmer'
                      : availabilityView?.state === 'available_from_date'
                        ? 'Disponible a une date future'
                        : 'Non disponible'}
                </p>
                <p>Visibilité entreprise : {profileVisibleToCompanies ? 'Oui' : 'Non'}</p>
                <p>Disponibilité immédiate : {immediateAvailabilityConfirmed ? 'Confirmée' : 'À confirmer'}</p>
                <p>Notifications quotidiennes : {availabilityNotificationsEnabled ? 'Actives' : 'Désactivées'}</p>
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

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-7 text-slate-300">
              Vous pouvez gérer ici votre disponibilité réelle sans quitter le tableau de bord. Les confirmations quotidiennes restent
              disponibles à tout moment.
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
              label="Questionnaire général Seven’O"
              value={questionnaireStateLabel}
              note={questionnaireStateNote}
              action={<Link href="/candidat/test" className="text-sm font-semibold text-cyan-100">{questionnaireActionLabel}</Link>}
            />
            <CandidateStatusCard
              tone="orange"
              label="Mes métiers recherchés"
              value={`${targetJobs.length}/3`}
              note={targetJobs.length > 0 ? targetJobs.map((job) => job.label).join(', ') : 'Sélectionnez entre un et trois métiers issus de la taxonomie Seven’O.'}
              action={<Link href="/candidat/onboarding" className="text-sm font-semibold text-cyan-100">{targetJobs.length < 3 ? 'Ajouter un métier recherché' : 'Modifier mes métiers'}</Link>}
            />
            <CandidateStatusCard
              tone="neutral"
              label="Statut du profil"
              value={profileStatusLabel}
              note={profileComplete ? 'Votre profil anonyme est prêt.' : 'Il pourra être activé après complétion des étapes obligatoires.'}
              action={<Link href="/candidat/onboarding" className="text-sm font-semibold text-cyan-100">{profileComplete ? 'Modifier mon profil' : 'Compléter mon profil'}</Link>}
            />
          </div>
        </div>
      )}
    </CandidateShell>
  );
}
