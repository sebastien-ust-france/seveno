'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { listCandidateOffersClient } from '@/lib/seveno-job-applications';
import { useSevenoCandidateSession } from '@/lib/use-seveno-candidate-session';
import type {
  CandidateOfferListItem,
  ImplementedJobApplicationStatus,
} from '@/types/seveno-job-applications';
import type {
  JobOfferContractType,
  JobOfferWorkingTime,
  JobOfferWorkMode,
} from '@/types/seveno-job-offers';

const CONTRACT_LABELS: Record<JobOfferContractType, string> = {
  permanent: 'CDI',
  fixed_term: 'CDD',
  temporary: 'Intérim',
  freelance: 'Freelance',
  apprenticeship: 'Alternance',
  internship: 'Stage',
  other: 'Autre',
};

const WORK_MODE_LABELS: Record<JobOfferWorkMode, string> = {
  onsite: 'Sur site',
  hybrid: 'Hybride',
  remote: 'À distance',
};

const WORKING_TIME_LABELS: Record<JobOfferWorkingTime, string> = {
  full_time: 'Temps plein',
  part_time: 'Temps partiel',
  shift: 'Horaires postés',
  flexible: 'Horaires flexibles',
  other: 'Autre',
};

const APPLICATION_STATUS_LABELS: Partial<Record<ImplementedJobApplicationStatus, string>> = {
  draft: 'Brouillon',
  prerequisites_in_progress: 'Prérequis en cours',
  eligible: 'Prête à envoyer',
  ineligible: 'Prérequis à vérifier',
  submitted: 'Envoyée',
  viewed: 'Consultée',
  questionnaire_pending: 'Questionnaire à compléter',
  questionnaire_completed: 'Questionnaire terminé',
  shortlisted: 'Présélectionnée',
  rejected: 'Non retenue',
  contact_requested: 'Contact demandé',
  conversation_open: 'Échange en cours',
  candidate_declined: 'Déclinée',
  company_declined: 'Non retenue',
  candidate_withdrawn: 'Retirée',
  offer_unavailable: 'Offre indisponible',
  withdrawn: 'Retirée',
  closed: 'Clôturée',
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date indisponible'
    : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(date);
}

function formatContract(value: JobOfferContractType | '') {
  return value ? CONTRACT_LABELS[value] : null;
}

function formatWorkMode(value: JobOfferWorkMode | '') {
  return value ? WORK_MODE_LABELS[value] : null;
}

function formatWorkingTime(value: JobOfferWorkingTime | '') {
  return value ? WORKING_TIME_LABELS[value] : null;
}

function applicationStatusLabel(status: ImplementedJobApplicationStatus | null) {
  return status ? APPLICATION_STATUS_LABELS[status] ?? 'Candidature en cours' : null;
}

export function CandidateOffersList() {
  const { authUser, loading: sessionLoading, error: sessionError } = useSevenoCandidateSession();
  const [offers, setOffers] = useState<CandidateOfferListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    let active = true;
    async function loadInitialOffers() {
      setLoading(true);
      setError(null);
      try {
        const payload = await listCandidateOffersClient(authUser!);
        if (!active) return;
        setOffers(payload.offers);
        setNextCursor(payload.nextCursor);
      } catch (thrownError) {
        if (active) {
          setError(thrownError instanceof Error ? thrownError.message : 'Les offres n’ont pas pu être chargées.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInitialOffers();
    return () => {
      active = false;
    };
  }, [authUser]);

  async function loadMore() {
    if (!authUser || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const payload = await listCandidateOffersClient(authUser, nextCursor);
      setOffers((current) => {
        const knownIds = new Set(current.map((offer) => offer.offerId));
        return [...current, ...payload.offers.filter((offer) => !knownIds.has(offer.offerId))];
      });
      setNextCursor(payload.nextCursor);
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Les offres suivantes n’ont pas pu être chargées.');
    } finally {
      setLoadingMore(false);
    }
  }

  const waiting = sessionLoading || loading;
  const visibleError = sessionError ?? error;

  return (
    <SevenoSurface
      eyebrow="Espace candidat"
      title="Offres pour mes métiers"
      description="Consultez les offres publiées correspondant aux métiers sélectionnés dans votre profil."
      actions={(
        <Link
          href="/candidat/onboarding"
          className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10"
        >
          Modifier mes métiers
        </Link>
      )}
      containerClassName="max-w-[86.4rem]"
    >
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Candidat', href: '/candidat' }, { label: 'Offres' }]} />

        {visibleError ? (
          <SevenoPanel tone="orange" role="alert">
            <p className="text-sm text-orange-100">{visibleError}</p>
          </SevenoPanel>
        ) : null}

        {waiting && offers.length === 0 ? (
          <SevenoPanel tone="neutral">
            <p className="text-sm text-slate-300" role="status">Chargement des offres…</p>
          </SevenoPanel>
        ) : null}

        {!waiting && !visibleError && offers.length === 0 ? (
          <SevenoPanel tone="neutral">
            <h2 className="text-xl font-semibold text-white">Aucune offre disponible pour le moment</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Les offres publiées apparaissent ici lorsqu’elles correspondent à l’un des métiers de votre profil.
            </p>
            <Link
              href="/candidat/onboarding"
              className="mt-5 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100"
            >
              Vérifier mes métiers
            </Link>
          </SevenoPanel>
        ) : null}

        {offers.length > 0 ? (
          <section aria-labelledby="candidate-offers-heading">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/75">Opportunités accessibles</p>
                <h2 id="candidate-offers-heading" className="mt-2 text-2xl font-semibold text-white">
                  {offers.length} {offers.length > 1 ? 'offres affichées' : 'offre affichée'}
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-400">
                Votre identité privée reste masquée tant que le parcours prévu ne vous demande pas de la révéler.
              </p>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {offers.map((offer) => {
                const statusLabel = applicationStatusLabel(offer.applicationStatus);
                const details = [
                  offer.location || formatWorkMode(offer.workMode),
                  formatContract(offer.contractType),
                  formatWorkingTime(offer.workingTime),
                ].filter((value): value is string => Boolean(value));

                return (
                  <SevenoPanel key={offer.offerId} tone={offer.applicationId ? 'cyan' : 'neutral'} className="flex h-full flex-col">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/75">{offer.companyName}</p>
                        <h3 className="mt-2 text-xl font-semibold text-white">{offer.title}</h3>
                        <p className="mt-2 text-sm text-slate-300">{offer.jobRoleLabel}</p>
                      </div>
                      {statusLabel ? (
                        <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-100">
                          {statusLabel}
                        </span>
                      ) : null}
                    </div>

                    {details.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                        {details.map((detail) => (
                          <span key={detail} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{detail}</span>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl border border-orange-300/15 bg-orange-400/[0.06] p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-orange-200/70">Obligatoires</p>
                        <p className="mt-1 font-semibold text-white">{offer.requiredPrerequisitesCount}</p>
                      </div>
                      <div className="rounded-2xl border border-blue-300/15 bg-blue-400/[0.06] p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-blue-200/70">Optionnels</p>
                        <p className="mt-1 font-semibold text-white">{offer.preferredPrerequisitesCount}</p>
                      </div>
                    </div>

                    <div className="mt-auto pt-5">
                      <p className="text-xs text-slate-500">Publiée le {formatDate(offer.publishedAt)}</p>
                      <Link
                        href={`/candidat/offres/${encodeURIComponent(offer.offerId)}`}
                        className="mt-4 inline-flex rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
                      >
                        {offer.applicationId ? 'Voir ma candidature' : 'Consulter l’offre'}
                      </Link>
                    </div>
                  </SevenoPanel>
                );
              })}
            </div>
          </section>
        ) : null}

        {nextCursor ? (
          <div className="flex justify-center">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 disabled:opacity-60"
            >
              {loadingMore ? 'Chargement…' : 'Afficher plus d’offres'}
            </button>
          </div>
        ) : null}
      </div>
    </SevenoSurface>
  );
}
