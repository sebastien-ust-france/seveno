'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { listCandidateOffersClient } from '@/lib/seveno-job-applications';
import { useSevenoCandidateSession } from '@/lib/use-seveno-candidate-session';
import type { CandidateOfferListItem } from '@/types/seveno-job-applications';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  prerequisites_in_progress: 'Réponses en cours',
  eligible: 'Prête à envoyer',
  ineligible: 'Prérequis obligatoire non satisfait',
  submitted: 'Envoyée',
  withdrawn: 'Retirée',
};

export default function CandidateOffersPage() {
  const { authUser, profile, loading: sessionLoading, error: sessionError } = useSevenoCandidateSession();
  const [offers, setOffers] = useState<CandidateOfferListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadOffers(append = false, cursor?: string | null) {
    if (!authUser) return;
    setLoading(true);
    try {
      const payload = await listCandidateOffersClient(authUser, cursor);
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

  return <SevenoSurface eyebrow="Espace candidat" title="Offres pour mes métiers" description="Uniquement les offres publiées correspondant aux métiers de votre profil." containerClassName="max-w-[96rem]">
    <div className="space-y-6">
      {profile?.profileStatus !== 'active' ? <SevenoPanel tone="orange"><p className="text-sm text-orange-100">Activez votre profil pour consulter et enregistrer une candidature.</p></SevenoPanel> : null}
      {sessionError || error ? <SevenoPanel tone="orange"><p className="text-sm text-orange-100">{sessionError ?? error}</p></SevenoPanel> : null}
      <SevenoPanel tone="neutral">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold text-white">Offres correspondantes</h2><span className="text-sm text-slate-400">{offers.length} affichée(s)</span></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {(sessionLoading || loading) && offers.length === 0 ? <p className="text-sm text-slate-400">Chargement...</p> : null}
          {!sessionLoading && !loading && offers.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="font-medium text-white">Aucune offre publiée ne correspond actuellement à vos métiers.</p></div> : null}
          {offers.map((offer) => <article key={offer.offerId} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">{offer.companyName}</p>
            <h3 className="mt-2 text-lg font-semibold text-white">{offer.title}</h3>
            <p className="mt-2 text-sm text-slate-300">{offer.jobRoleLabel}</p>
            <p className="mt-2 text-sm text-slate-400">{offer.location || offer.workMode} - {offer.contractType} - {offer.workingTime}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300"><span>{offer.requiredPrerequisitesCount} obligatoire(s)</span><span>{offer.preferredPrerequisitesCount} valeur(s) ajoutée(s)</span></div>
            {offer.applicationStatus ? <p className="mt-3 text-xs text-violet-200">Candidature : {STATUS_LABELS[offer.applicationStatus] ?? offer.applicationStatus}</p> : null}
            <Link href={`/candidat/offres/${offer.offerId}`} className="mt-5 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100">{offer.applicationId ? 'Continuer ma candidature' : "Voir l’offre"}</Link>
          </article>)}
        </div>
        {nextCursor ? <button type="button" disabled={loading} onClick={() => void loadOffers(true, nextCursor)} className="mt-5 rounded-full border border-white/10 px-4 py-2 text-sm text-white">Charger la suite</button> : null}
      </SevenoPanel>
    </div>
  </SevenoSurface>;
}
