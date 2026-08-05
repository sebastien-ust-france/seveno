'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import {
  activateCompanyApplicationNotifications,
  activateCompanyQuestionnaireNotifications,
  getCompanyNotificationState,
  getPassiveCompanyNotificationReadiness,
  setCompanyApplicationNotifications,
  setCompanyQuestionnaireNotifications,
  subscribeToCompanyApplicationForegroundNotifications,
} from '@/lib/seveno-company-notifications-client';
import {
  COMPANY_NOTIFICATION_BROWSER_LABELS,
  COMPANY_NOTIFICATION_DEVICE_LABELS,
  COMPANY_NOTIFICATION_PREFERENCE_LABELS,
  type CompanyNotificationReadiness,
} from '@/lib/seveno-company-notification-readiness';
import type { CompanyApplicationForegroundNotification } from '@/lib/seveno-company-notification-foreground';
import { useSevenoCompanySession } from '@/lib/use-seveno-company-session';

export function CompanyNotificationCenter() {
  const { authUser, profile, loading: sessionLoading, error: sessionError } = useSevenoCompanySession();
  const [readiness, setReadiness] = useState<CompanyNotificationReadiness | null>(null);
  const [loadingPreference, setLoadingPreference] = useState<'application_received' | 'questionnaire_completed' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [foregroundNotification, setForegroundNotification] = useState<CompanyApplicationForegroundNotification | null>(null);

  useEffect(() => {
    let active = true;
    if (!authUser || !profile) {
      return () => {
        active = false;
      };
    }

    void getCompanyNotificationState(authUser)
      .then(getPassiveCompanyNotificationReadiness)
      .then((snapshot) => {
        if (active) {
          setReadiness(snapshot);
        }
      })
      .catch((thrownError) => {
        if (active) {
          setError(thrownError instanceof Error ? thrownError.message : 'L’état des notifications est indisponible.');
        }
      });

    return () => {
      active = false;
    };
  }, [authUser, profile]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;

    void subscribeToCompanyApplicationForegroundNotifications((notification) => {
      if (active) {
        setForegroundNotification(notification);
      }
    }).then((unsubscribeForeground) => {
      if (active) {
        unsubscribe = unsubscribeForeground;
      } else {
        unsubscribeForeground();
      }
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  if (sessionLoading || sessionError || !authUser || !profile) {
    return null;
  }

  async function refreshReadiness() {
    if (!authUser) {
      return;
    }
    const serverState = await getCompanyNotificationState(authUser);
    setReadiness(await getPassiveCompanyNotificationReadiness(serverState));
  }

  async function handleToggle(notificationType: 'application_received' | 'questionnaire_completed') {
    if (!authUser || loadingPreference) {
      return;
    }
    setLoadingPreference(notificationType);
    setError(null);
    setNotice(null);
    try {
      const isQuestionnaire = notificationType === 'questionnaire_completed';
      const enabled = isQuestionnaire
        ? readiness?.questionnaireCompleted === 'enabled'
        : readiness?.applicationReceived === 'enabled';
      if (enabled) {
        if (isQuestionnaire) {
          await setCompanyQuestionnaireNotifications(authUser, false);
        } else {
          await setCompanyApplicationNotifications(authUser, false);
        }
        await refreshReadiness();
        setNotice(isQuestionnaire
          ? 'Les notifications de questionnaires terminés sont désactivées.'
          : 'Les notifications de nouvelles candidatures sont désactivées.');
      } else {
        const activatedReadiness = isQuestionnaire
          ? await activateCompanyQuestionnaireNotifications(authUser)
          : await activateCompanyApplicationNotifications(authUser);
        setReadiness(activatedReadiness);
        if (isQuestionnaire ? !activatedReadiness.questionnaireReady : !activatedReadiness.ready) {
          throw new Error('L’activation n’a pas pu être confirmée sur cet appareil.');
        }
        setNotice(isQuestionnaire
          ? 'Les notifications de questionnaires terminés sont activées sur cet appareil.'
          : 'Les notifications de nouvelles candidatures sont activées sur cet appareil.');
      }
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La configuration des notifications a échoué.');
      await refreshReadiness().catch(() => undefined);
    } finally {
      setLoadingPreference(null);
    }
  }

  const browserLabel = readiness ? COMPANY_NOTIFICATION_BROWSER_LABELS[readiness.browser] : 'Chargement…';
  const deviceLabel = readiness ? COMPANY_NOTIFICATION_DEVICE_LABELS[readiness.device] : 'Chargement…';
  const applicationPreferenceLabel = readiness
    ? COMPANY_NOTIFICATION_PREFERENCE_LABELS[readiness.applicationReceived]
    : 'Chargement…';
  const questionnairePreferenceLabel = readiness
    ? COMPANY_NOTIFICATION_PREFERENCE_LABELS[readiness.questionnaireCompleted]
    : 'Chargement…';

  return (
    <div className="px-4 pt-4 sm:px-6 lg:px-8">
      <SevenoPanel tone="neutral" className="p-5">
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Notifications entreprise</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Suivi des candidatures</h2>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
              <p>Navigateur : <span className="font-medium text-white">{browserLabel}</span></p>
              <p>Cet appareil : <span className="font-medium text-white">{deviceLabel}</span></p>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-300">
                Nouvelles candidatures : <span className="font-medium text-white">{applicationPreferenceLabel}</span>
              </p>
              <button
                type="button"
                onClick={() => void handleToggle('application_received')}
                disabled={Boolean(loadingPreference) || !readiness}
                className="inline-flex shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingPreference === 'application_received'
                  ? 'Mise à jour…'
                  : readiness?.applicationReceived === 'enabled'
                    ? 'Désactiver'
                    : 'Activer'}
              </button>
            </div>
            <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-300">
                Questionnaires terminés : <span className="font-medium text-white">{questionnairePreferenceLabel}</span>
              </p>
              <button
                type="button"
                onClick={() => void handleToggle('questionnaire_completed')}
                disabled={Boolean(loadingPreference) || !readiness}
                className="inline-flex shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingPreference === 'questionnaire_completed'
                  ? 'Mise à jour…'
                  : readiness?.questionnaireCompleted === 'enabled'
                    ? 'Désactiver'
                    : 'Activer'}
              </button>
            </div>
          </div>
        </div>

        {notice ? <p className="mt-4 text-sm text-cyan-100">{notice}</p> : null}
        {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}

        {foregroundNotification ? (
          <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4">
            <p className="font-semibold text-white">{foregroundNotification.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{foregroundNotification.body}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link
                href={foregroundNotification.clickUrl}
                onClick={() => setForegroundNotification(null)}
                className="inline-flex rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                {foregroundNotification.kind === 'company_questionnaire_completed'
                  ? 'Voir le résultat'
                  : 'Voir la candidature'}
              </Link>
              <button
                type="button"
                onClick={() => setForegroundNotification(null)}
                className="text-sm text-slate-300 underline-offset-4 hover:underline"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : null}
      </SevenoPanel>
    </div>
  );
}
