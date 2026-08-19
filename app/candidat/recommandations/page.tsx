'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CandidateShell } from '@/components/candidate/CandidateShell';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import { Select } from '@/components/ui/Select';
import { useSevenoCandidateSession } from '@/lib/use-seveno-candidate-session';
import {
  createCandidateRecommendationInvitationClient,
  loadCandidateRecommendationDashboard,
  resendCandidateRecommendationInvitationClient,
  revokeCandidateRecommendationInvitationClient,
} from '@/lib/seveno-recommendations';
import type {
  CandidateRecommendation,
  CandidateRecommendationInvitationInput,
  CandidateRecommendationRequest,
  RecommendationRelationType,
} from '@/types/seveno';

const RELATION_OPTIONS: Array<{ value: RecommendationRelationType; label: string }> = [
  { value: 'former_employer', label: 'Ancien employeur' },
  { value: 'former_manager', label: 'Ancien manager' },
  { value: 'hr_manager', label: 'Responsable RH' },
  { value: 'executive', label: 'Direction' },
  { value: 'professional_client', label: 'Client professionnel' },
  { value: 'other_professional_manager', label: 'Référent professionnel' },
];

const CAN_SHOW_PUBLIC_LINK = process.env.NODE_ENV !== 'production';

function formatDateTime(value: unknown) {
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    }
  }

  if (!value || typeof value !== 'object') {
    return 'Non disponible';
  }

  if ('toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format((value as { toDate: () => Date }).toDate());
  }

  const record = value as { _seconds?: unknown; _nanoseconds?: unknown; seconds?: unknown; nanoseconds?: unknown };
  const seconds = typeof record._seconds === 'number'
    ? record._seconds
    : typeof record.seconds === 'number'
      ? record.seconds
      : null;
  const nanoseconds = typeof record._nanoseconds === 'number'
    ? record._nanoseconds
    : typeof record.nanoseconds === 'number'
      ? record.nanoseconds
      : 0;

  if (seconds === null) {
    return 'Non disponible';
  }

  const date = new Date((seconds * 1000) + Math.round(nanoseconds / 1_000_000));
  if (Number.isNaN(date.getTime())) {
    return 'Non disponible';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function requestStatusLabel(value: CandidateRecommendationRequest['status']) {
  switch (value) {
    case 'sent':
      return 'Envoyée';
    case 'viewed':
      return 'Consultée';
    case 'submitted':
      return 'Soumise';
    case 'expired':
      return 'Expirée';
    case 'revoked':
      return 'Révoquée';
    default:
      return 'Brouillon';
  }
}

function verificationStatusLabel(value: CandidateRecommendation['verificationStatus']) {
  switch (value) {
    case 'verified':
      return 'Vérifiée';
    case 'verification_pending':
      return 'En attente de vérification';
    case 'verification_rejected':
      return 'Refusée';
    default:
      return 'Non démarrée';
  }
}

function wouldRehireLabel(value: CandidateRecommendation['wouldRehire']) {
  switch (value) {
    case 'yes':
      return 'Oui';
    case 'depends_on_position':
      return 'Selon le poste';
    case 'no':
      return 'Non';
    default:
      return 'Je préfère ne pas répondre';
  }
}

export default function CandidateRecommendationsPage() {
  const { authUser, profile, loading: sessionLoading, error: sessionError } = useSevenoCandidateSession();
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<{
    invitationCount: number;
    verificationPendingCount: number;
    verifiedCount: number;
    visibleCount: number;
    requests: CandidateRecommendationRequest[];
    recommendations: CandidateRecommendation[];
  } | null>(null);

  const [form, setForm] = useState<CandidateRecommendationInvitationInput>({
    respondentFirstName: '',
    respondentLastName: '',
    respondentTitle: '',
    respondentCompanyName: '',
    respondentWebsite: '',
    respondentSiret: '',
    respondentEmail: '',
    relationType: 'former_employer',
    candidateJobTitle: '',
    collaborationPeriodLabel: '',
    collaborationStartLabel: '',
    collaborationEndLabel: '',
  });

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!authUser || !profile) {
        return;
      }

      try {
        const payload = await loadCandidateRecommendationDashboard(authUser);
        if (!active) {
          return;
        }

        setDashboard(payload);
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : 'Les recommandations n ont pas pu etre chargees.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (authUser && profile) {
      void bootstrap();
    } else if (!sessionLoading) {
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [authUser, profile, sessionLoading]);

  const summaryCards = useMemo(() => dashboard ? [
    { label: 'Invitations actives', value: dashboard.invitationCount, note: 'Invitations en attente de réponse.' },
    { label: 'En vérification', value: dashboard.verificationPendingCount, note: 'Avis soumis mais pas encore validés.' },
    { label: 'Vérifiées', value: dashboard.verifiedCount, note: 'Recommandations validées automatiquement ou par un administrateur.' },
    { label: 'Visibles entreprise', value: dashboard.visibleCount, note: 'Les seules visibles côté entreprise.' },
  ] : [], [dashboard]);

  async function loadDashboard() {
    if (!authUser) {
      return;
    }

    const payload = await loadCandidateRecommendationDashboard(authUser);
    setDashboard(payload);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authUser) {
      return;
    }

    setSavingId('create');
    setError(null);
    setNotice(null);
    setPublicLink(null);

    try {
      const payload = await createCandidateRecommendationInvitationClient(authUser, {
        respondentFirstName: form.respondentFirstName.trim(),
        respondentLastName: form.respondentLastName.trim(),
        respondentTitle: form.respondentTitle.trim(),
        respondentCompanyName: form.respondentCompanyName.trim(),
        ...((form.respondentWebsite ?? '').trim() ? { respondentWebsite: (form.respondentWebsite ?? '').trim() } : {}),
        ...((form.respondentSiret ?? '').trim() ? { respondentSiret: (form.respondentSiret ?? '').trim() } : {}),
        respondentEmail: form.respondentEmail.trim(),
        relationType: form.relationType,
        candidateJobTitle: form.candidateJobTitle.trim(),
        collaborationPeriodLabel: form.collaborationPeriodLabel.trim(),
        ...((form.collaborationStartLabel ?? '').trim() ? { collaborationStartLabel: (form.collaborationStartLabel ?? '').trim() } : {}),
        ...((form.collaborationEndLabel ?? '').trim() ? { collaborationEndLabel: (form.collaborationEndLabel ?? '').trim() } : {}),
      });
      setPublicLink(payload.publicLink);
      setNotice(`Invitation créée pour ${payload.request.respondentFirstName} ${payload.request.respondentLastName}.`);
      setForm({
        respondentFirstName: '',
        respondentLastName: '',
        respondentTitle: '',
        respondentCompanyName: '',
        respondentWebsite: '',
        respondentSiret: '',
        respondentEmail: '',
        relationType: 'former_employer',
        candidateJobTitle: '',
        collaborationPeriodLabel: '',
        collaborationStartLabel: '',
        collaborationEndLabel: '',
      });
      await loadDashboard();
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : "L invitation n a pas pu etre créée.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleResend(requestId: string) {
    if (!authUser) {
      return;
    }

    setSavingId(requestId);
    setError(null);
    setNotice(null);
    try {
      const payload = await resendCandidateRecommendationInvitationClient(authUser, requestId);
      setPublicLink(payload.publicLink);
      setNotice('Invitation renvoyée. Le nouveau lien a été généré.');
      await loadDashboard();
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Le renvoi a échoué.');
    } finally {
      setSavingId(null);
    }
  }

  async function handleRevoke(requestId: string) {
    if (!authUser) {
      return;
    }

    setSavingId(requestId);
    setError(null);
    setNotice(null);
    try {
      await revokeCandidateRecommendationInvitationClient(authUser, requestId);
      setNotice('Invitation révoquée.');
      await loadDashboard();
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La révocation a échoué.');
    } finally {
      setSavingId(null);
    }
  }

  async function copyPublicLink() {
    if (!publicLink || typeof window === 'undefined' || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(`${window.location.origin}${publicLink}`);
    setNotice('Lien public copié dans le presse-papiers.');
  }

  const absolutePublicLink = CAN_SHOW_PUBLIC_LINK && publicLink && typeof window !== 'undefined'
    ? `${window.location.origin}${publicLink}`
    : null;

  return (
    <CandidateShell
      title="Mes recommandations"
      description="Demandez à d anciens employeurs ou managers de partager un avis vérifié sur votre parcours. Les entreprises ne verront que les recommandations validées et rendues visibles."
    >
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Candidat', href: '/candidat' },
            { label: 'Recommandations', href: '/candidat/recommandations' },
          ]}
        />

        {sessionError ? (
          <SevenoPanel tone="orange" className="p-4 text-sm leading-7 text-orange-100">
            {sessionError}
          </SevenoPanel>
        ) : null}

        {notice ? (
          <SevenoPanel tone="cyan" className="p-4 text-sm leading-7 text-cyan-100">
            {notice}
          </SevenoPanel>
        ) : null}

        {error ? (
          <SevenoPanel tone="orange" className="p-4 text-sm leading-7 text-amber-100">
            {error}
          </SevenoPanel>
        ) : null}

        {CAN_SHOW_PUBLIC_LINK && absolutePublicLink ? (
          <SevenoPanel tone="blue" className="p-4 text-sm leading-7 text-blue-100">
            <p className="font-semibold text-white">Lien public prêt à partager</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200">
                {absolutePublicLink}
              </code>
              <button
                type="button"
                onClick={() => void copyPublicLink()}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Copier le lien
              </button>
            </div>
          </SevenoPanel>
        ) : publicLink ? (
          <SevenoPanel tone="blue" className="p-4 text-sm leading-7 text-blue-100">
            <p className="font-semibold text-white">Lien public généré</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Le lien sécurisé a été préparé côté serveur, mais il n’est pas affiché dans cette configuration.
            </p>
          </SevenoPanel>
        ) : null}

        {loading || sessionLoading ? (
          <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
            Chargement des recommandations...
          </SevenoPanel>
        ) : null}

        {dashboard ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <SevenoPanel key={card.label} tone="neutral" className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">{card.label}</p>
                  <p className="mt-3 text-2xl font-semibold text-white">{card.value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{card.note}</p>
                </SevenoPanel>
              ))}
            </div>

            <SevenoPanel tone="neutral" className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Créer une invitation</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Demander une recommandation</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Renseignez l’identité du répondant, son lien professionnel et le contexte de collaboration. Le lien public est généré côté serveur.
              </p>

              <form className="mt-5 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">Prénom</span>
                    <input
                      value={form.respondentFirstName}
                      onChange={(event) => setForm((current) => ({ ...current, respondentFirstName: event.target.value }))}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">Nom</span>
                    <input
                      value={form.respondentLastName}
                      onChange={(event) => setForm((current) => ({ ...current, respondentLastName: event.target.value }))}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">Fonction</span>
                    <input
                      value={form.respondentTitle}
                      onChange={(event) => setForm((current) => ({ ...current, respondentTitle: event.target.value }))}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">Entreprise</span>
                    <input
                      value={form.respondentCompanyName}
                      onChange={(event) => setForm((current) => ({ ...current, respondentCompanyName: event.target.value }))}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">Site web professionnel</span>
                    <input
                      value={form.respondentWebsite ?? ''}
                      onChange={(event) => setForm((current) => ({ ...current, respondentWebsite: event.target.value }))}
                      placeholder="https://..."
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">SIRET</span>
                    <input
                      value={form.respondentSiret ?? ''}
                      onChange={(event) => setForm((current) => ({ ...current, respondentSiret: event.target.value }))}
                      inputMode="numeric"
                      placeholder="14 chiffres"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                    />
                  </label>
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-slate-200">Email</span>
                    <input
                      value={form.respondentEmail}
                      onChange={(event) => setForm((current) => ({ ...current, respondentEmail: event.target.value }))}
                      type="email"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">Relation</span>
                    <Select
                      value={form.relationType}
                      onChange={(event) => setForm((current) => ({ ...current, relationType: event.target.value as RecommendationRelationType }))}
                    >
                      {RELATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">Poste occupé</span>
                    <input
                      value={form.candidateJobTitle}
                      onChange={(event) => setForm((current) => ({ ...current, candidateJobTitle: event.target.value }))}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">Période de collaboration</span>
                    <input
                      value={form.collaborationPeriodLabel}
                      onChange={(event) => setForm((current) => ({ ...current, collaborationPeriodLabel: event.target.value }))}
                      placeholder="Jan 2022 - Août 2024"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">Début</span>
                    <input
                      value={form.collaborationStartLabel ?? ''}
                      onChange={(event) => setForm((current) => ({ ...current, collaborationStartLabel: event.target.value }))}
                      placeholder="Optionnel"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">Fin</span>
                    <input
                      value={form.collaborationEndLabel ?? ''}
                      onChange={(event) => setForm((current) => ({ ...current, collaborationEndLabel: event.target.value }))}
                      placeholder="Optionnel"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={savingId === 'create'}
                    className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingId === 'create' ? 'Création...' : 'Créer l invitation'}
                  </button>
                  <Link
                    href="/candidat"
                    className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    Retour au tableau de bord
                  </Link>
                </div>
              </form>
            </SevenoPanel>

            <div className="grid gap-4 xl:grid-cols-2">
              <SevenoPanel tone="neutral" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Invitations</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Demandes envoyées</h3>
                <div className="mt-5 space-y-4">
                  {dashboard.requests.length === 0 ? (
                    <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-400">
                      Aucune invitation pour le moment.
                    </p>
                  ) : (
                    dashboard.requests.map((request) => (
                      <article key={request.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {request.respondentFirstName} {request.respondentLastName}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                              {request.respondentTitle} · {request.respondentCompanyName}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-slate-200">
                              {requestStatusLabel(request.status)}
                            </span>
                            <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-slate-200">
                              {verificationStatusLabel(request.verificationStatus)}
                            </span>
                          </div>
                        </div>

                        <p className="mt-3 text-sm text-slate-300">
                          {request.candidateJobTitle} · {request.collaborationPeriodLabel}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          Dernier envoi : {formatDateTime(request.lastSentAt)}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => void handleResend(request.id)}
                            disabled={savingId === request.id || request.status === 'revoked' || request.status === 'expired' || request.status === 'submitted'}
                            className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Renvoyer
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRevoke(request.id)}
                            disabled={savingId === request.id || request.status === 'revoked' || request.status === 'submitted'}
                            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Révoquer
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </SevenoPanel>

              <SevenoPanel tone="neutral" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Recommandations</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Avis reçus</h3>
                <div className="mt-5 space-y-4">
                  {dashboard.recommendations.length === 0 ? (
                    <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-400">
                      Aucune recommandation reçue pour le moment.
                    </p>
                  ) : (
                    dashboard.recommendations.map((recommendation) => (
                      <article key={recommendation.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {recommendation.respondentFirstName} {recommendation.respondentLastName}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                              {recommendation.respondentTitle} · {recommendation.respondentCompanyName}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-slate-200">
                              {verificationStatusLabel(recommendation.verificationStatus)}
                            </span>
                            <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-slate-200">
                              {recommendation.candidateVisibility === 'visible' ? 'Visible' : 'Masquée'}
                            </span>
                          </div>
                        </div>

                        <p className="mt-3 text-sm text-slate-300">
                          {recommendation.candidateJobTitle} · {recommendation.collaborationPeriodLabel}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          Je recommanderais à nouveau : {wouldRehireLabel(recommendation.wouldRehire)}
                        </p>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Qualités</p>
                            <p className="mt-2 text-sm text-white">{recommendation.qualities.join(', ')}</p>
                          </article>
                          <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Certification</p>
                            <p className="mt-2 text-sm text-white">
                              {recommendation.certificationAccepted ? 'Acceptée' : 'Refusée'}
                            </p>
                          </article>
                        </div>

                        {recommendation.comment ? (
                          <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm leading-7 text-slate-300">
                            {recommendation.comment}
                          </p>
                        ) : null}

                        <div className="mt-4 grid gap-2 md:grid-cols-5">
                          {(Object.keys(recommendation.ratings) as Array<keyof CandidateRecommendation['ratings']>).map((key) => (
                            <div key={key} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                                {key === 'reliability'
                                  ? 'Fiabilité'
                                  : key === 'autonomy'
                                    ? 'Autonomie'
                                    : key === 'teamwork'
                                      ? "Esprit d'équipe"
                                      : key === 'communication'
                                        ? 'Communication'
                                        : 'Adaptabilité'}
                              </p>
                              <p className="mt-2 text-sm text-white">{recommendation.ratings[key]}</p>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </SevenoPanel>
            </div>
          </>
        ) : null}
      </div>
    </CandidateShell>
  );
}
