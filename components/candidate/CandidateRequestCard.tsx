'use client';

import { SevenoPanel, type SevenoTone } from '@/components/seveno/SevenoLayout';
import { formatMatchRequestContractType, formatMatchRequestDate, formatMatchRequestStatus } from '@/lib/seveno-match-display';
import type { SerializedCandidateMatchRequest } from '@/types/seveno';

type CandidateRequestCardProps = {
  request: SerializedCandidateMatchRequest;
  tone: SevenoTone;
  sectorLabel: string;
  familyLabel: string;
  roleLabel: string;
  companySectorLabel: string;
  loading?: boolean;
  onAccept?: () => void;
  onRefuse?: () => void;
};

function statusClass(status: SerializedCandidateMatchRequest['status']) {
  switch (status) {
    case 'accepted':
      return 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100';
    case 'refused':
      return 'border-blue-300/20 bg-blue-400/10 text-blue-100';
    case 'pending_candidate':
      return 'border-orange-300/20 bg-orange-400/10 text-orange-100';
    default:
      return 'border-white/10 bg-white/5 text-slate-200';
  }
}

function statusDescription(status: SerializedCandidateMatchRequest['status']) {
  switch (status) {
    case 'accepted':
      return 'Coordonnées débloquées via le flux sécurisé Seven’O.';
    case 'refused':
      return 'La demande a été archivée sans transmission de coordonnées.';
    case 'cancelled':
      return 'La demande a été annulée par l’entreprise.';
    case 'expired':
      return 'La demande a expiré sans réponse.';
    case 'pending_candidate':
    default:
      return 'Vos coordonnées restent bloquées tant que vous n’avez pas validé.';
  }
}

export function CandidateRequestCard({
  request,
  tone,
  sectorLabel,
  familyLabel,
  roleLabel,
  companySectorLabel,
  loading = false,
  onAccept,
  onRefuse,
}: CandidateRequestCardProps) {
  const isPending = request.status === 'pending_candidate';
  const isClosed = request.status !== 'pending_candidate' && request.status !== 'accepted';

  return (
    <SevenoPanel tone={tone} className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <span
            className={
              'inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ' +
              statusClass(request.status)
            }
          >
            {formatMatchRequestStatus(request.status)}
          </span>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Entreprise</p>
            <p className="mt-2 text-lg font-semibold text-white">{request.companyNameSnapshot}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{companySectorLabel}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Créée le</p>
          <p className="mt-2 font-medium text-white">{formatMatchRequestDate(request.createdAt)}</p>
          {request.candidateDecisionAt ? (
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Réponse le {formatMatchRequestDate(request.candidateDecisionAt)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Secteur entreprise</p>
          <p className="mt-2 text-sm font-medium text-white">{companySectorLabel}</p>
        </article>

        <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Poste proposé</p>
          <p className="mt-2 text-sm font-medium text-white">{request.proposedJobTitle ?? roleLabel}</p>
        </article>

        <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Localisation</p>
          <p className="mt-2 text-sm font-medium text-white">{request.proposedLocation ?? 'À discuter'}</p>
        </article>

        <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Contrat</p>
          <p className="mt-2 text-sm font-medium text-white">{formatMatchRequestContractType(request.contractType)}</p>
        </article>

        <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Métier cible</p>
          <p className="mt-2 text-sm font-medium text-white">{roleLabel}</p>
        </article>

        <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Famille</p>
          <p className="mt-2 text-sm font-medium text-white">{familyLabel}</p>
        </article>

        <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Cible anonyme</p>
          <p className="mt-2 text-sm font-medium text-white">{request.publicCandidateId}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            {sectorLabel} / {familyLabel} / {roleLabel}
          </p>
        </article>

        <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">État</p>
          <p className="mt-2 text-sm font-medium text-white">{statusDescription(request.status)}</p>
        </article>
      </div>

      {request.message ? (
        <div className="mt-5 rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            Message de l’entreprise
          </p>
          <p className="mt-3 whitespace-pre-wrap">{request.message}</p>
        </div>
      ) : null}

      {isPending ? (
        <div className="mt-5 rounded-[22px] border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(34,211,238,0.08),rgb(var(--seveno-brand-blue)/0.06),rgba(249,115,22,0.04))] p-4">
          <p className="text-sm font-medium text-white">
            Vos coordonnées ne seront transmises qu’après votre accord.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            En acceptant, vous autorisez Seven’O à transmettre vos coordonnées à cette entreprise.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onAccept}
              disabled={loading}
              className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Traitement...' : 'Accepter'}
            </button>

            <button
              type="button"
              onClick={onRefuse}
              disabled={loading}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Traitement...' : 'Refuser'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
          <p className="font-medium text-white">Décision enregistrée</p>
          <p className="mt-3">{statusDescription(request.status)}</p>
          {isClosed ? <p className="mt-2 text-slate-400">Aucune coordonnée privée n’est affichée ici.</p> : null}
        </div>
      )}
    </SevenoPanel>
  );
}
