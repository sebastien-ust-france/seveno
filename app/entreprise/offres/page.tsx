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
  deleteCompanyJobOffer,
  duplicateCompanyJobOffer,
  listCompanyJobOffers,
  reassignCompanyJobOffer,
} from '@/lib/seveno-job-offers';
import { getCompanyMembersClient } from '@/lib/seveno-billing-client';
import type { CompanyMembershipView } from '@/types/seveno-billing';
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

type OfferFilter = JobOfferStatus | 'all';
const FILTERS: Array<{ value: OfferFilter; label: string }> = [
  { value: 'published', label: 'Actives' },
  { value: 'draft', label: 'Brouillons' },
  { value: 'paused', label: 'En pause' },
  { value: 'closed', label: 'Clôturées' },
  { value: 'archived', label: 'Archivées' },
  { value: 'all', label: 'Toutes' },
];

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date indisponible' : date.toLocaleString('fr-FR');
}

export default function CompanyOffersPage() {
  const { authUser, profile, membershipRole, loading: sessionLoading, error: sessionError } = useSevenoCompanySession();
  const [scope, setScope] = useState<'mine' | 'company'>('mine');
  const [offers, setOffers] = useState<SerializedJobOffer[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OfferFilter>('published');
  const [offerToDelete, setOfferToDelete] = useState<SerializedJobOffer | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<CompanyMembershipView[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [reassignment, setReassignment] = useState<{ offer: SerializedJobOffer; targetUid: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('scope') === 'company' && (membershipRole === 'owner' || membershipRole === 'admin')) {
      setScope('company');
      setAssigneeFilter(params.get('assignedToUid') ?? '');
    }
  }, [membershipRole]);

  async function loadOffers(append = false, cursor?: string | null) {
    if (!authUser) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await listCompanyJobOffers(authUser, { cursor, scope, ...(scope === 'company' && assigneeFilter ? { assignedToUid: assigneeFilter } : {}), ...(statusFilter !== 'all' ? { status: statusFilter } : {}) });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, statusFilter, scope, assigneeFilter]);

  useEffect(() => {
    if (!authUser || (membershipRole !== 'owner' && membershipRole !== 'admin')) return;
    void getCompanyMembersClient(authUser).then((payload) => setMembers(payload.members.filter((member) => member.status === 'active' && ['owner', 'admin', 'recruiter'].includes(member.role)))).catch(() => setMembers([]));
  }, [authUser, membershipRole]);

  async function confirmReassignment() {
    if (!authUser || !reassignment?.targetUid) return;
    setActionId(reassignment.offer.id);
    try {
      await reassignCompanyJobOffer(authUser, reassignment.offer.id, reassignment.targetUid);
      setReassignment(null);
      await loadOffers();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'La réattribution a échoué.'); }
    finally { setActionId(null); }
  }

  async function changeStatus(offerId: string, action: JobOfferStatusAction) {
    if (!authUser || actionId) return;
    const confirmations: Partial<Record<JobOfferStatusAction, string>> = {
      reactivate: 'Réactiver cette offre ?\n\nElle redeviendra visible et pourra recevoir de nouvelles candidatures.',
      close: 'Clôturer cette offre ?\n\nElle ne recevra plus de nouvelles candidatures. Les candidatures, questionnaires et échanges existants resteront accessibles.',
      archive: 'Archiver cette offre ?\n\nL’offre sera retirée de vos offres actives, mais son historique sera conservé.',
      restore: 'Restaurer cette offre en brouillon ?\n\nL’offre redeviendra modifiable. Elle ne sera pas publiée automatiquement.',
    };
    if (confirmations[action] && !window.confirm(confirmations[action])) return;
    setActionId(offerId);
    setError(null);
    try {
      const payload = await changeCompanyJobOfferStatus(authUser, offerId, action);
      setOffers((current) => statusFilter === 'all' || payload.offer.status === statusFilter
        ? current.map((item) => item.id === offerId ? payload.offer : item)
        : current.filter((item) => item.id !== offerId));
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Le statut n’a pas pu être modifié.');
    } finally {
      setActionId(null);
    }
  }

  async function duplicateOffer(offerId: string) {
    if (!authUser || actionId) return;
    setActionId(offerId);
    setError(null);
    try {
      const payload = await duplicateCompanyJobOffer(authUser, offerId);
      setStatusFilter('draft');
      setOffers([payload.offer]);
      setNextCursor(null);
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'L’offre n’a pas pu être dupliquée.');
    } finally {
      setActionId(null);
    }
  }

  async function deleteOffer(offerId: string) {
    if (!authUser || actionId) return;
    if (deleteConfirmation !== 'SUPPRIMER') return;
    setActionId(offerId);
    setError(null);
    try {
      await deleteCompanyJobOffer(authUser, offerId);
      setOffers((current) => current.filter((item) => item.id !== offerId));
      setOfferToDelete(null);
      setDeleteConfirmation('');
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'L’offre n’a pas pu être supprimée.');
    } finally {
      setActionId(null);
    }
  }

  return (
    <SevenoSurface
      eyebrow="Espace entreprise"
      title={scope === 'mine' ? 'Mes recrutements' : 'Tous les recrutements'}
      description="Créez, reprenez et pilotez les recrutements dont vous avez la responsabilité."
      actions={<Link href="/entreprise/offres/nouvelle" className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-white">Créer une offre</Link>}
      containerClassName="max-w-[96rem]"
    >
      <div className="space-y-6">
        {sessionError || error ? <SevenoPanel tone="orange"><p className="text-sm text-orange-100">{sessionError ?? error}</p></SevenoPanel> : null}
        {profile && isCompanyProfileIncomplete(profile) ? <SevenoPanel tone="orange"><p className="text-sm text-orange-100">Votre profil entreprise est incomplet. Vous pouvez préparer un brouillon, mais devrez compléter le profil avant publication.</p></SevenoPanel> : null}
        <SevenoPanel tone="neutral">
          {membershipRole === 'owner' || membershipRole === 'admin' ? <div className="mb-4 flex gap-2"><button type="button" onClick={() => setScope('mine')} className={scope === 'mine' ? 'rounded-full bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950' : 'rounded-full border border-white/10 px-4 py-2 text-xs text-slate-300'}>Mes recrutements</button><button type="button" onClick={() => setScope('company')} className={scope === 'company' ? 'rounded-full bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950' : 'rounded-full border border-white/10 px-4 py-2 text-xs text-slate-300'}>Tous les recrutements</button></div> : null}
          <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold text-white">Offres enregistrées</h2><span className="text-sm text-slate-400">{offers.length} {offers.length > 1 ? 'affichées' : 'affichée'}</span></div>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Filtrer les offres">
            {FILTERS.map((filter) => (
              <button key={filter.value} type="button" onClick={() => setStatusFilter(filter.value)} className={statusFilter === filter.value ? 'rounded-full bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950' : 'rounded-full border border-white/10 px-4 py-2 text-xs text-slate-300'}>
                {filter.label}
              </button>
            ))}
          </div>
          {scope === 'company' && (membershipRole === 'owner' || membershipRole === 'admin') ? <label className="mt-4 block max-w-sm text-sm text-slate-300">Responsable<select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"><option value="">Tous</option>{members.map((member) => <option key={member.userUid} value={member.userUid}>{member.displayName || member.email || 'Membre'}</option>)}</select></label> : null}
          <div className="mt-5 space-y-4">
            {(sessionLoading || loading) && offers.length === 0 ? <p className="text-sm text-slate-400">Chargement...</p> : null}
            {!sessionLoading && !loading && offers.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="font-medium text-white">Aucun recrutement ne vous est attribué pour le moment.</p>{membershipRole === 'owner' || membershipRole === 'admin' ? <button type="button" onClick={() => setScope('company')} className="mt-3 text-sm text-cyan-200">Voir tous les recrutements</button> : null}</div> : null}
            {offers.map((offer) => (
              <article key={offer.id} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><p className="text-xs uppercase tracking-[0.22em] text-cyan-200/70">{offer.jobRoleLabel || 'Métier à compléter'}</p><h3 className="mt-2 text-lg font-semibold text-white">{offer.title || 'Offre sans titre'}</h3><p className="mt-2 text-sm text-slate-400">{offer.location || offer.workMode || 'Localisation à compléter'} - Mise à jour {formatDate(offer.updatedAt)}</p></div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">{STATUS_LABELS[offer.status]}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-300"><span>{offer.requiredPrerequisites.length} {offer.requiredPrerequisites.length > 1 ? 'obligatoires' : 'obligatoire'}</span><span>{offer.preferredPrerequisites.length} {offer.preferredPrerequisites.length > 1 ? 'valeurs ajoutées' : 'valeur ajoutée'}</span><span>Version {offer.version}</span></div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">Responsable : {members.find((member) => member.userUid === offer.assignedToUid)?.displayName || members.find((member) => member.userUid === offer.assignedToUid)?.email || 'Non renseigné'}</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-300">
                    {offer.questionnaireId ? `Questionnaire associé : ${offer.questionnaireTitleSnapshot || 'Questionnaire sans titre'} (${offer.questionnaireQuestionCountSnapshot ?? 0} ${(offer.questionnaireQuestionCountSnapshot ?? 0) > 1 ? 'questions' : 'question'})` : 'Aucun questionnaire associé'}
                  </span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {offer.status !== 'closed' && offer.status !== 'archived' ? <Link href={`/entreprise/offres/${offer.id}/modifier`} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white">Modifier</Link> : null}
                  <Link href={`/entreprise/offres/${offer.id}/questionnaire`} className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-2 text-xs text-violet-100">Questionnaire</Link>
                  {(membershipRole === 'owner' || membershipRole === 'admin') && offer.assignedToUid ? <button type="button" onClick={() => setReassignment({ offer, targetUid: offer.assignedToUid })} className="rounded-full border border-cyan-300/20 px-3 py-2 text-xs text-cyan-100">Changer de responsable</button> : null}
            {offer.status === 'draft' ? <button type="button" disabled={Boolean(actionId)} onClick={() => void changeStatus(offer.id, 'publish')} className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100 disabled:opacity-40">Publier</button> : null}
            {offer.status === 'published' ? <button type="button" disabled={Boolean(actionId)} onClick={() => void changeStatus(offer.id, 'pause')} className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100 disabled:opacity-40">Mettre en pause</button> : null}
            {offer.status === 'paused' ? <button type="button" disabled={Boolean(actionId)} onClick={() => void changeStatus(offer.id, 'reactivate')} className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100 disabled:opacity-40">Réactiver</button> : null}
            {(offer.status === 'published' || offer.status === 'paused') ? <button type="button" disabled={Boolean(actionId)} onClick={() => void changeStatus(offer.id, 'close')} className="rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100 disabled:opacity-40">Clôturer l’offre</button> : null}
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-full border border-white/10 px-3 py-2 text-xs text-slate-200">Autres actions</summary>
              <div className="absolute right-0 z-10 mt-2 grid min-w-56 gap-2 rounded-2xl border border-white/10 bg-slate-950 p-3 shadow-2xl">
                <button type="button" disabled={Boolean(actionId)} onClick={() => void duplicateOffer(offer.id)} className="rounded-xl px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10 disabled:opacity-40">Dupliquer l’offre</button>
                {(offer.status === 'paused' || offer.status === 'closed') ? <button type="button" disabled={Boolean(actionId)} onClick={() => void changeStatus(offer.id, 'archive')} className="rounded-xl px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10 disabled:opacity-40">Archiver</button> : null}
                {(offer.status === 'closed' || offer.status === 'archived') ? <button type="button" disabled={Boolean(actionId)} onClick={() => void changeStatus(offer.id, 'restore')} className="rounded-xl px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10 disabled:opacity-40">Restaurer en brouillon</button> : null}
                {(offer.status === 'draft' || offer.status === 'archived') ? <button type="button" disabled={Boolean(actionId)} onClick={() => { setOfferToDelete(offer); setDeleteConfirmation(''); }} className="rounded-xl px-3 py-2 text-left text-xs text-rose-200 hover:bg-rose-400/10 disabled:opacity-40">Supprimer définitivement</button> : null}
              </div>
            </details>
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
      {offerToDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-offer-title">
          <div className="w-full max-w-lg rounded-3xl border border-rose-300/20 bg-slate-950 p-6 shadow-2xl">
            <h2 id="delete-offer-title" className="text-xl font-semibold text-white">Supprimer définitivement cette offre ?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">Cette action est irréversible. Elle est uniquement possible si aucune candidature, aucun questionnaire et aucun échange ne sont liés à l’offre.</p>
            <label className="mt-5 block text-sm text-slate-200">
              Saisissez <strong>SUPPRIMER</strong> pour confirmer.
              <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-rose-300/50" autoFocus />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={Boolean(actionId)} onClick={() => { setOfferToDelete(null); setDeleteConfirmation(''); }} className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 disabled:opacity-40">Annuler</button>
              <button type="button" disabled={Boolean(actionId) || deleteConfirmation !== 'SUPPRIMER'} onClick={() => void deleteOffer(offerToDelete.id)} className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Supprimer définitivement</button>
            </div>
          </div>
        </div>
      ) : null}
      {reassignment ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950 p-6"><h2 className="text-xl font-semibold text-white">Changer de responsable</h2><label className="mt-4 block text-sm text-slate-200">Responsable du recrutement<select value={reassignment.targetUid} onChange={(event) => setReassignment({ ...reassignment, targetUid: event.target.value })} className="mt-2 w-full rounded-xl bg-slate-900 p-3">{members.map((member) => <option key={member.userUid} value={member.userUid}>{member.displayName || member.email || 'Membre'}</option>)}</select></label><p className="mt-4 text-sm leading-6 text-slate-300">Ce recrutement sera désormais attribué à {members.find((member) => member.userUid === reassignment.targetUid)?.displayName || members.find((member) => member.userUid === reassignment.targetUid)?.email || 'ce membre'}. Les candidatures, questionnaires et mises en relation associés resteront inchangés.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setReassignment(null)} className="rounded-full border border-white/10 px-4 py-2">Annuler</button><button type="button" disabled={!reassignment.targetUid || Boolean(actionId)} onClick={() => void confirmReassignment()} className="rounded-full bg-cyan-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-40">Réattribuer le recrutement</button></div></div></div> : null}
    </SevenoSurface>
  );
}
