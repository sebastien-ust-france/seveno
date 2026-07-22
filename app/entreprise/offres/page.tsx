'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import {
  MAX_ACTIVE_CANDIDATE_FILES_PER_OFFER,
  buildOfferCapacityLabel,
  buildOfferCapacityReminderMessage,
} from '@/lib/seveno-active-candidate-files';
import {
  changeCompanyJobOfferStatus,
  listCompanyJobOffers,
} from '@/lib/seveno-job-offers';
import { useSevenoCompanySession } from '@/lib/use-seveno-company-session';
import { isCompanyProfileIncomplete } from '@/lib/seveno-companies';
import type {
  JobOfferStatus,
  JobOfferStatusAction,
  SerializedJobOffer,
} from '@/types/seveno-job-offers';

const STATUS_LABELS: Record<JobOfferStatus, string> = {
  draft: 'Brouillon',
  published: 'Publiée',
  paused: 'En pause',
  closed: 'Fermée',
  archived: 'Archivée',
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date indisponible' : date.toLocaleString('fr-FR');
}

export default function CompanyOffersPage() {
  const { authUser, profile, loading: sessionLoading, error: sessionError } = useSevenoCompanySession();
  const [offers, setOffers] = useState<SerializedJobOffer[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadOffers(append = false, cursor?: string | null) {
    if (!authUser) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await listCompanyJobOffers(authUser, { cursor });
      setOffers((current) => append ? [...current, ...payload.offers] : payload.offers);
      setNextCursor(payload.nextCursor);
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Les offres n’ont pas pu être chargées.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authUser) void loadOffers();
    // Authentication is the only automatic loading trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  async function changeStatus(offerId: string, action: JobOfferStatusAction) {
    if (!authUser || actionId) return;
    if ((action === 'close' || action === 'archive') && !window.confirm("Cette action limite définitivement la reprise de l'offre. Continuer ?")) return;
    setActionId(offerId);
    setError(null);
    try {
      const payload = await changeCompanyJobOfferStatus(authUser, offerId, action);
      setOffers((current) => current.map((item) => item.id === offerId ? payload.offer : item));
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Le statut n’a pas pu être modifié.');
    } finally {
      setActionId(null);
    }
  }

  return (
    <SevenoSurface
      eyebrow="Espace entreprise"
      title="Mes offres"
      description="Créez, reprenez et pilotez vos offres structurées Seven’O."
      actions={<Link href="/entreprise/offres/nouvelle" className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 text-sm font-semibold text-white">Créer une offre</Link>}
      containerClassName="max-w-[96rem]"
    >
      <div className="space-y-6">
        {sessionError || error ? <SevenoPanel tone="orange"><p className="text-sm text-orange-100">{sessionError ?? error}</p></SevenoPanel> : null}
        {profile && isCompanyProfileIncomplete(profile) ? <SevenoPanel tone="orange"><p className="text-sm text-orange-100">Votre profil entreprise est incomplet. Vous pouvez préparer un brouillon, mais devrez compléter le profil avant publication.</p></SevenoPanel> : null}
        <SevenoPanel tone="neutral">
          <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold text-white">Offres enregistrées</h2><span className="text-sm text-slate-400">{offers.length} affichée(s)</span></div>
          <div className="mt-5 space-y-4">
            {(sessionLoading || loading) && offers.length === 0 ? <p className="text-sm text-slate-400">Chargement...</p> : null}
            {!sessionLoading && !loading && offers.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="font-medium text-white">Aucune offre pour le moment.</p><p className="mt-2 text-sm text-slate-400">Créez un premier brouillon pour commencer.</p></div> : null}
            {offers.map((offer) => (
              <article key={offer.id} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><p className="text-xs uppercase tracking-[0.22em] text-cyan-200/70">{offer.jobRoleLabel || 'Métier à compléter'}</p><h3 className="mt-2 text-lg font-semibold text-white">{offer.title || 'Offre sans titre'}</h3><p className="mt-2 text-sm text-slate-400">{offer.location || offer.workMode || 'Localisation à compléter'} - Mise à jour {formatDate(offer.updatedAt)}</p></div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">{STATUS_LABELS[offer.status]}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-300"><span>{offer.requiredPrerequisites.length} obligatoire(s)</span><span>{offer.preferredPrerequisites.length} valeur(s) ajoutée(s)</span><span>Version {offer.version}</span></div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-300">
                    {offer.questionnaireId ? `Questionnaire associé : ${offer.questionnaireTitleSnapshot || 'Questionnaire sans titre'} (${offer.questionnaireQuestionCountSnapshot ?? 0} question(s))` : 'Aucun questionnaire associé'}
                  </span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {offer.status !== 'closed' && offer.status !== 'archived' ? <Link href={`/entreprise/offres/${offer.id}/modifier`} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white">Modifier</Link> : null}
                  {offer.status !== 'closed' && offer.status !== 'archived' ? <Link href={`/entreprise/offres/${offer.id}/questionnaire`} className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-2 text-xs text-violet-100">Questionnaire</Link> : null}
            {(offer.status === 'draft' || offer.status === 'paused') ? <button type="button" disabled={Boolean(actionId)} onClick={() => void changeStatus(offer.id, 'publish')} className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100 disabled:opacity-40">Publier</button> : null}
            {offer.status === 'published' ? <button type="button" disabled={Boolean(actionId)} onClick={() => void changeStatus(offer.id, 'pause')} className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100 disabled:opacity-40">Mettre en pause</button> : null}
            {(offer.status === 'published' || offer.status === 'paused') ? <button type="button" disabled={Boolean(actionId)} onClick={() => void changeStatus(offer.id, 'close')} className="rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100 disabled:opacity-40">Fermer</button> : null}
            {offer.status === 'closed' ? <button type="button" disabled={Boolean(actionId)} onClick={() => void changeStatus(offer.id, 'archive')} className="rounded-full border border-white/10 px-3 py-2 text-xs text-slate-300 disabled:opacity-40">Archiver</button> : null}
          </div>
          {(() => {
            const activeCandidateFilesCount = offer.activeCandidateFilesCount ?? 0;
            const reminder = buildOfferCapacityReminderMessage(activeCandidateFilesCount);
            const applicationsHref = `/entreprise/demandes?offerId=${encodeURIComponent(offer.id)}`;

            return (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">
                    {buildOfferCapacityLabel(activeCandidateFilesCount)}
                  </span>
                  {activeCandidateFilesCount > 0 ? (
                    <Link
                      href={applicationsHref}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200 transition hover:bg-white/10"
                    >
                      Traiter les candidatures en cours
                    </Link>
                  ) : null}
                </div>
                {reminder ? (
                  <p
                    className={
                      'max-w-2xl rounded-2xl border px-4 py-3 text-sm leading-6 ' +
                      (activeCandidateFilesCount >= MAX_ACTIVE_CANDIDATE_FILES_PER_OFFER
                        ? 'border-orange-300/20 bg-orange-400/10 text-orange-100'
                        : 'border-white/10 bg-white/5 text-slate-300')
                    }
                  >
                    {reminder}
                  </p>
                ) : null}
              </div>
            );
          })()}
        </article>
            ))}
          </div>
          {nextCursor ? <button type="button" disabled={loading} onClick={() => void loadOffers(true, nextCursor)} className="mt-5 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">Charger la suite</button> : null}
        </SevenoPanel>
      </div>
    </SevenoSurface>
  );
}
