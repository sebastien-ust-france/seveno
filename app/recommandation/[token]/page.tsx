'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Select } from '@/components/ui/Select';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import {
  loadPublicCandidateRecommendationBundle,
  submitPublicCandidateRecommendation,
} from '@/lib/seveno-recommendations';
import type {
  CandidateRecommendationPublicBundle,
  CandidateRecommendationSubmissionInput,
  CandidateRecommendationRatingSet,
  RecommendationRatingLevel,
  RecommendationWouldRehire,
} from '@/types/seveno';

const QUALITY_OPTIONS = [
  'Fiable',
  'Autonome',
  'Esprit d équipe',
  'Communication claire',
  'Adaptable',
  'Rigoureux',
] as const;

const DEFAULT_RATINGS: CandidateRecommendationRatingSet = {
  reliability: 'satisfactory',
  autonomy: 'satisfactory',
  teamwork: 'satisfactory',
  communication: 'satisfactory',
  adaptability: 'satisfactory',
};

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

export default function PublicRecommendationPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string'
    ? params.token
    : Array.isArray(params?.token)
      ? params.token[0]
      : '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bundle, setBundle] = useState<CandidateRecommendationPublicBundle | null>(null);
  const [form, setForm] = useState<CandidateRecommendationSubmissionInput>({
    qualities: ['Fiable'],
    ratings: DEFAULT_RATINGS,
    comment: '',
    wouldRehire: 'yes',
    consentToRevealIdentity: true,
    certificationAccepted: false,
  });

  useEffect(() => {
    let active = true;

    async function load() {
      if (!token) {
        setError('Le lien de recommandation est invalide.');
        setLoading(false);
        return;
      }

      try {
        const payload = await loadPublicCandidateRecommendationBundle(token);
        if (!active) {
          return;
        }

        setBundle(payload);
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : 'Le lien de recommandation est invalide.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [token]);

  const invitation = bundle?.invitation ?? null;
  const candidate = bundle?.candidate ?? null;
  const selectedQualities = useMemo(() => form.qualities, [form.qualities]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const payload = await submitPublicCandidateRecommendation(token, {
        qualities: form.qualities,
        ratings: form.ratings,
        comment: form.comment?.trim() || undefined,
        wouldRehire: form.wouldRehire,
        consentToRevealIdentity: form.consentToRevealIdentity,
        certificationAccepted: form.certificationAccepted,
      });

      setNotice(`Merci. La recommandation a été enregistrée le ${formatDateTime(payload.recommendation.createdAt)}.`);
      setForm((current) => ({
        ...current,
        comment: '',
        certificationAccepted: false,
      }));
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La recommandation n a pas pu etre envoyee.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SevenoSurface
      eyebrow="Recommandation"
      title="Avis professionnel"
      description="Complétez ce formulaire une seule fois. Votre identité restera masquée si vous ne l’autorisez pas explicitement."
      containerClassName="max-w-6xl"
    >
      <div className="space-y-6">
        {loading ? (
          <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
            Chargement du lien de recommandation...
          </SevenoPanel>
        ) : error ? (
          <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">
            {error}
          </SevenoPanel>
        ) : null}

        {notice ? (
          <SevenoPanel tone="cyan" className="p-5 text-sm leading-7 text-cyan-100">
            {notice}
          </SevenoPanel>
        ) : null}

        {bundle && invitation ? (
          <>
            <SevenoPanel tone="neutral" className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Contexte</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Référence</p>
                  <p className="mt-2 text-sm font-medium text-white">{candidate?.publicCandidateId ?? invitation.publicCandidateId}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Répondant</p>
                  <p className="mt-2 text-sm font-medium text-white">{invitation.respondentFirstName} {invitation.respondentLastName}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Entreprise</p>
                  <p className="mt-2 text-sm font-medium text-white">{invitation.respondentCompanyName}</p>
                  {invitation.respondentWebsite ? (
                    <p className="mt-2 text-xs text-slate-400">{invitation.respondentWebsite}</p>
                  ) : null}
                  {invitation.respondentSiret ? (
                    <p className="mt-1 text-xs text-slate-400">SIRET: {invitation.respondentSiret}</p>
                  ) : null}
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Période</p>
                  <p className="mt-2 text-sm font-medium text-white">{invitation.collaborationPeriodLabel}</p>
                </article>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                {invitation.respondentTitle} · {invitation.relationType} · {invitation.candidateJobTitle}
              </p>
            </SevenoPanel>

            <SevenoPanel tone="neutral" className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Questionnaire</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Partager un avis vérifié</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Sélectionnez les qualités les plus représentatives, évaluez les points clés du travail, puis confirmez si vous seriez prêt à recommander à nouveau cette personne.
              </p>

              <form className="mt-5 space-y-5" onSubmit={(event) => void handleSubmit(event)}>
                <div className="space-y-3">
                  <span className="text-sm font-medium text-slate-200">Qualités observées</span>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {QUALITY_OPTIONS.map((quality) => {
                      const selected = selectedQualities.includes(quality);
                      return (
                        <button
                          key={quality}
                          type="button"
                          onClick={() => setForm((current) => {
                            const has = current.qualities.includes(quality);
                            return {
                              ...current,
                              qualities: has
                                ? current.qualities.filter((item) => item !== quality)
                                : [...current.qualities, quality],
                            };
                          })}
                          className={
                            'rounded-2xl border px-4 py-3 text-left text-sm transition '
                            + (selected
                              ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100'
                              : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10')
                          }
                        >
                          {quality}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  {(Object.keys(form.ratings) as Array<keyof CandidateRecommendationRatingSet>).map((key) => (
                    <label key={key} className="space-y-2">
                      <span className="text-sm font-medium text-slate-200">
                        {key === 'reliability'
                          ? 'Fiabilité'
                          : key === 'autonomy'
                            ? 'Autonomie'
                            : key === 'teamwork'
                              ? "Esprit d'équipe"
                              : key === 'communication'
                                ? 'Communication'
                                : 'Adaptabilité'}
                      </span>
                      <Select
                        value={form.ratings[key]}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          ratings: {
                            ...current.ratings,
                            [key]: event.target.value as RecommendationRatingLevel,
                          },
                        }))}
                      >
                        <option value="excellent">Excellent</option>
                        <option value="very_satisfactory">Très satisfaisant</option>
                        <option value="satisfactory">Satisfaisant</option>
                        <option value="needs_improvement">À améliorer</option>
                      </Select>
                    </label>
                  ))}
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-200">Je recommanderais cette personne à nouveau</span>
                  <Select
                    value={form.wouldRehire}
                    onChange={(event) => setForm((current) => ({ ...current, wouldRehire: event.target.value as RecommendationWouldRehire }))}
                  >
                    <option value="yes">Oui</option>
                    <option value="depends_on_position">Selon le poste</option>
                    <option value="no">Non</option>
                    <option value="prefer_not_to_answer">Je préfère ne pas répondre</option>
                  </Select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-200">Commentaire libre</span>
                  <textarea
                    rows={4}
                    value={form.comment ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                  />
                </label>

                <div className="space-y-3 rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={form.consentToRevealIdentity}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        consentToRevealIdentity: event.target.checked,
                      }))}
                      className="mt-1 accent-cyan-400"
                    />
                    <span>J autorise la révélation de mon identité auprès des entreprises après vérification.</span>
                  </label>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={form.certificationAccepted}
                      onChange={(event) => setForm((current) => ({ ...current, certificationAccepted: event.target.checked }))}
                      className="mt-1 accent-cyan-400"
                    />
                    <span>Je certifie avoir eu une relation professionnelle réelle avec cette personne, répondre personnellement et de bonne foi, et accepter les règles applicables aux recommandations Seven’O.</span>
                  </label>
                  <p className="text-xs leading-6 text-slate-400">
                    <Link href="/cgu#article-15" className="text-cyan-200 transition hover:text-cyan-100">
                      Consulter l’article relatif aux recommandations dans les CGU Seven’O
                    </Link>
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? 'Envoi...' : 'Envoyer la recommandation'}
                  </button>
                  <Link
                    href="/candidat"
                    className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    Retour au tableau de bord candidat
                  </Link>
                </div>
              </form>
            </SevenoPanel>
          </>
        ) : null}
      </div>
    </SevenoSurface>
  );
}
