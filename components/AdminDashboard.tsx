'use client';

import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  formatStudyAnswerValue,
  getAnsweredSummary,
  getProfileLabel,
} from '@/lib/study-analytics';
import { getAcquisitionSourceLabel } from '@/lib/study-acquisition';
import type { IntentBand, StudyBreakdownItem, StudyStats } from '@/lib/study-analytics';
import type {
  RespondentType,
  StudyAnswerValue,
  StudyAcquisitionSourceCode,
  StudyResponseRecord,
} from '@/types/study';

type FilterValue = 'all' | 'yes' | 'no';
type Tone = 'cyan' | 'violet' | 'green' | 'orange' | 'amber' | 'teal' | 'slate';

interface AdminStudyResponseItem {
  id: string;
  respondentType?: RespondentType;
  answers?: Partial<Record<string, StudyAnswerValue>>;
  wantsLaunchNotification?: boolean;
  wantsBetaAccess?: boolean;
  wantsProjectUpdates?: boolean;
  email?: string;
  phone?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  discoverySource?: StudyAcquisitionSourceCode;
  logoFeedback?: 'yes' | 'no';
  visitorFingerprint?: string;
  createdAtMs: number | null;
}

interface AdminStudyMetrics {
  totalResponses: number;
  byProfile: Record<RespondentType, number>;
  launchCount: number;
  betaCount: number;
  launchRate: number;
  betaRate: number;
  intentCounts: Record<IntentBand, number>;
  projectUpdatesYesCount: number;
  projectUpdatesNoCount: number;
  projectUpdatesRate: number;
  projectUpdatesBaseCount: number;
  logoFeedbackYesCount: number;
  logoFeedbackNoCount: number;
  logoFeedbackBaseCount: number;
  logoFeedbackRate: number;
}

interface AdminStudyQualityStats {
  totalResponses: number;
  uniqueEmails: number;
  uniquePhones: number;
  uniqueFingerprints: number;
  duplicateEmailResponses: number;
  duplicatePhoneResponses: number;
  duplicateFingerprintResponses: number;
  burstResponses: number;
  suspectResponses: number;
}

interface AdminStudyPayload {
  metrics: AdminStudyMetrics;
  studyStats: StudyStats;
  qualityStats: AdminStudyQualityStats;
}

interface AdminStudyRespondentsPayload {
  responses: AdminStudyResponseItem[];
  responseCount: number;
  responsePage: number;
  responsePageSize: number;
  responseTotalPages: number;
}

const ADMIN_STORAGE_KEY = 'seveno_admin_code';
const respondentsPageSize = 10;

const profileOptions: Array<{ value: 'all' | RespondentType; label: string }> = [
  { value: 'all', label: 'Tous les profils' },
  { value: 'professional_available', label: 'Professionnel disponible' },
  { value: 'professional_employed', label: 'Professionnel déjà en poste' },
  { value: 'company', label: 'Entreprise' },
  { value: 'agency', label: 'Agence / cabinet RH' },
];

const yesNoOptions: Array<{ value: FilterValue; label: string }> = [
  { value: 'all', label: 'Tous' },
  { value: 'yes', label: 'Oui' },
  { value: 'no', label: 'Non' },
];

const toneStyles: Record<
  Tone,
  {
    panel: string;
    panelSoft: string;
    border: string;
    accent: string;
    badge: string;
    chip: string;
    tableHead: string;
    tableRow: string;
    statLabel: string;
    statValue: string;
  }
> = {
  cyan: {
    panel: 'border-cyan-400/20 bg-cyan-400/10',
    panelSoft: 'bg-cyan-400/5',
    border: 'border-cyan-400/20',
    accent: 'bg-cyan-400',
    badge: 'bg-cyan-400/12 text-cyan-100 ring-1 ring-inset ring-cyan-400/20',
    chip: 'bg-cyan-400/12 text-cyan-100 ring-1 ring-inset ring-cyan-400/20',
    tableHead: 'bg-cyan-400/10 text-cyan-100',
    tableRow: 'odd:bg-slate-900/60 even:bg-slate-950/50',
    statLabel: 'text-cyan-100/70',
    statValue: 'text-white',
  },
  violet: {
    panel: 'border-violet-400/20 bg-violet-400/10',
    panelSoft: 'bg-violet-400/5',
    border: 'border-violet-400/20',
    accent: 'bg-violet-400',
    badge: 'bg-violet-400/12 text-violet-100 ring-1 ring-inset ring-violet-400/20',
    chip: 'bg-violet-400/12 text-violet-100 ring-1 ring-inset ring-violet-400/20',
    tableHead: 'bg-violet-400/10 text-violet-100',
    tableRow: 'odd:bg-slate-900/60 even:bg-slate-950/50',
    statLabel: 'text-violet-100/70',
    statValue: 'text-white',
  },
  green: {
    panel: 'border-emerald-400/20 bg-emerald-400/10',
    panelSoft: 'bg-emerald-400/5',
    border: 'border-emerald-400/20',
    accent: 'bg-emerald-400',
    badge: 'bg-emerald-400/12 text-emerald-100 ring-1 ring-inset ring-emerald-400/20',
    chip: 'bg-emerald-400/12 text-emerald-100 ring-1 ring-inset ring-emerald-400/20',
    tableHead: 'bg-emerald-400/10 text-emerald-100',
    tableRow: 'odd:bg-slate-900/60 even:bg-slate-950/50',
    statLabel: 'text-emerald-100/70',
    statValue: 'text-white',
  },
  orange: {
    panel: 'border-orange-400/20 bg-orange-400/10',
    panelSoft: 'bg-orange-400/5',
    border: 'border-orange-400/20',
    accent: 'bg-orange-400',
    badge: 'bg-orange-400/12 text-orange-100 ring-1 ring-inset ring-orange-400/20',
    chip: 'bg-orange-400/12 text-orange-100 ring-1 ring-inset ring-orange-400/20',
    tableHead: 'bg-orange-400/10 text-orange-100',
    tableRow: 'odd:bg-slate-900/60 even:bg-slate-950/50',
    statLabel: 'text-orange-100/70',
    statValue: 'text-white',
  },
  amber: {
    panel: 'border-amber-400/20 bg-amber-400/10',
    panelSoft: 'bg-amber-400/5',
    border: 'border-amber-400/20',
    accent: 'bg-amber-400',
    badge: 'bg-amber-400/12 text-amber-100 ring-1 ring-inset ring-amber-400/20',
    chip: 'bg-amber-400/12 text-amber-100 ring-1 ring-inset ring-amber-400/20',
    tableHead: 'bg-amber-400/10 text-amber-100',
    tableRow: 'odd:bg-slate-900/60 even:bg-slate-950/50',
    statLabel: 'text-amber-100/70',
    statValue: 'text-white',
  },
  teal: {
    panel: 'border-cyan-300/20 bg-cyan-300/10',
    panelSoft: 'bg-cyan-300/5',
    border: 'border-cyan-300/20',
    accent: 'bg-cyan-300',
    badge: 'bg-cyan-300/12 text-cyan-50 ring-1 ring-inset ring-cyan-300/20',
    chip: 'bg-cyan-300/12 text-cyan-50 ring-1 ring-inset ring-cyan-300/20',
    tableHead: 'bg-cyan-300/10 text-cyan-50',
    tableRow: 'odd:bg-slate-900/60 even:bg-slate-950/50',
    statLabel: 'text-cyan-50/75',
    statValue: 'text-white',
  },
  slate: {
    panel: 'border-white/10 bg-white/5',
    panelSoft: 'bg-white/5',
    border: 'border-white/10',
    accent: 'bg-slate-400',
    badge: 'bg-white/5 text-slate-200 ring-1 ring-inset ring-white/10',
    chip: 'bg-white/5 text-slate-200 ring-1 ring-inset ring-white/10',
    tableHead: 'bg-white/5 text-slate-200',
    tableRow: 'odd:bg-white/[0.03] even:bg-white/[0.05]',
    statLabel: 'text-slate-300/75',
    statValue: 'text-white',
  },
};

function formatPercent(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: number | null) {
  if (!value) {
    return 'Date inconnue';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function toStudyRecord(response: AdminStudyResponseItem): StudyResponseRecord {
  return {
    id: response.id,
    respondentType: response.respondentType,
    answers: response.answers,
    wantsLaunchNotification: response.wantsLaunchNotification,
    wantsBetaAccess: response.wantsBetaAccess,
    wantsProjectUpdates: response.wantsProjectUpdates,
    email: response.email,
    phone: response.phone,
    source: response.source,
    utmSource: response.utmSource,
    utmMedium: response.utmMedium,
    utmCampaign: response.utmCampaign,
    discoverySource: response.discoverySource as StudyAcquisitionSourceCode | undefined,
    logoFeedback: response.logoFeedback,
    visitorFingerprint: response.visitorFingerprint,
    createdAt: null,
  };
}

function getBooleanLabel(value?: boolean) {
  if (value === true) return 'Oui';
  if (value === false) return 'Non';
  return 'N/A';
}

function formatShare(count: number, total: number) {
  if (total <= 0) {
    return '0 %';
  }

  return formatPercent(count / total);
}

function sortBreakdown(items: Array<{ value: string; label: string; count: number }>) {
  return [...items].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return left.label.localeCompare(right.label, 'fr');
  });
}

function ToneBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-wide',
        toneStyles[tone].badge,
      ].join(' ')}
    >
      {children}
    </span>
  );
}

function SectionCard({
  tone,
  eyebrow,
  title,
  description,
  children,
  className = '',
}: {
  tone: Tone;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const styles = toneStyles[tone];

  return (
    <section
      className={[
        'rounded-3xl border bg-slate-900/75 p-5 shadow-[0_24px_80px_-40px_rgba(2,6,23,0.95)] backdrop-blur',
        styles.panel,
        className,
      ].join(' ')}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <ToneBadge tone={tone}>{eyebrow}</ToneBadge>
          <div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p> : null}
          </div>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function KpiCard({
  tone,
  label,
  value,
  detail,
}: {
  tone: Tone;
  label: string;
  value: string | number;
  detail?: ReactNode;
}) {
  const styles = toneStyles[tone];

  return (
    <article className={['relative overflow-hidden rounded-2xl border p-5', styles.panel, styles.border].join(' ')}>
      <span className={['absolute inset-x-0 top-0 h-1', styles.accent].join(' ')} />
      <p className={['text-sm font-medium', styles.statLabel].join(' ')}>{label}</p>
      <p className={['mt-3 text-3xl font-semibold tracking-tight', styles.statValue].join(' ')}>{value}</p>
      {detail ? <div className="mt-2 text-sm leading-6 text-slate-300">{detail}</div> : null}
    </article>
  );
}

function BreakdownTable({
  tone,
  title,
  items,
  total,
  highlightThreshold,
  highlightLabel = 'À intégrer à la taxonomie',
}: {
  tone: Tone;
  title: string;
  items: StudyBreakdownItem[];
  total: number;
  highlightThreshold?: number;
  highlightLabel?: string;
}) {
  const styles = toneStyles[tone];

  return (
    <article className={['rounded-2xl border p-5', styles.panel, styles.border].join(' ')}>
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <ToneBadge tone={tone}>{title}</ToneBadge>
          <p className="text-sm text-slate-300">{items.length} valeur(s)</p>
        </div>
        <p className="text-sm text-slate-400">Base: {total}</p>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className={styles.tableHead}>
            <tr>
              <th className="px-4 py-3 text-left font-medium">Valeur</th>
              <th className="px-4 py-3 text-right font-medium">Réponses</th>
              <th className="px-4 py-3 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-slate-950/65">
            {items.length > 0 ? (
              items.map((item) => (
                <tr key={item.value} className={styles.tableRow}>
                  <td className="px-4 py-3 text-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{item.label}</span>
                      {highlightThreshold !== undefined && item.count >= highlightThreshold ? (
                        <span className="inline-flex rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-100 ring-1 ring-inset ring-emerald-400/25">
                          {highlightLabel}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-100">{item.count}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{formatShare(item.count, total)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={3}>
                  Aucune donnée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function RespondentChip({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <span className={['inline-flex items-center rounded-full px-3 py-1 text-xs font-medium', toneStyles[tone].chip].join(' ')}>
      <span className="mr-1.5 text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <span>{value}</span>
    </span>
  );
}

export function AdminDashboard() {
  const [codeInput, setCodeInput] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [data, setData] = useState<AdminStudyPayload | null>(null);
  const [respondentsData, setRespondentsData] = useState<AdminStudyRespondentsPayload | null>(null);
  const [respondentsVisible, setRespondentsVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [respondentsLoading, setRespondentsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [respondentsError, setRespondentsError] = useState('');
  const [respondentFilters, setRespondentFilters] = useState<{
    search: string;
    profile: 'all' | RespondentType;
    launch: FilterValue;
    beta: FilterValue;
  }>({
    search: '',
    profile: 'all',
    launch: 'all',
    beta: 'all',
  });
  const [respondentPage, setRespondentPage] = useState(1);

  const loadDashboard = useCallback(async (code: string) => {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setError('Entrez le code admin.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/study-responses', {
        method: 'GET',
        headers: {
          'x-admin-code': normalizedCode,
        },
        cache: 'no-store',
      });

      const payload = (await response.json()) as
        | AdminStudyPayload
        | {
            error?: string;
            message?: string;
          };

      if (!response.ok) {
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(ADMIN_STORAGE_KEY);
          }
          setAdminCode('');
          setCodeInput('');
          setRespondentsVisible(false);
          setRespondentsData(null);
        }

        setData(null);
        const errorPayload = payload as { message?: string };
        setError(errorPayload.message ?? 'Impossible de charger le dashboard.');
        return;
      }

      setAdminCode(normalizedCode);
      setData(payload as AdminStudyPayload);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ADMIN_STORAGE_KEY, normalizedCode);
      }
    } catch (fetchError) {
      setData(null);
      setError(fetchError instanceof Error ? fetchError.message : 'Impossible de charger le dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRespondents = useCallback(
    async (code: string, page = 1) => {
      const normalizedCode = code.trim();
      if (!normalizedCode) {
        setRespondentsError('Entrez le code admin.');
        return;
      }

      setRespondentsLoading(true);
      setRespondentsError('');

      try {
        const params = new URLSearchParams({
          includeResponses: '1',
          page: String(page),
          pageSize: String(respondentsPageSize),
          search: respondentFilters.search.trim(),
          profile: respondentFilters.profile,
          launch: respondentFilters.launch,
          beta: respondentFilters.beta,
        });

        const response = await fetch(`/api/admin/study-responses?${params.toString()}`, {
          method: 'GET',
          headers: {
            'x-admin-code': normalizedCode,
          },
          cache: 'no-store',
        });

        const payload = (await response.json()) as
          | AdminStudyRespondentsPayload
          | {
              error?: string;
              message?: string;
            };

        if (!response.ok) {
          if (response.status === 401) {
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem(ADMIN_STORAGE_KEY);
            }
            setAdminCode('');
            setCodeInput('');
            setRespondentsVisible(false);
            setRespondentsData(null);
          }

          setRespondentsData(null);
          const errorPayload = payload as { message?: string };
          setRespondentsError(errorPayload.message ?? 'Impossible de charger les répondants.');
          return;
        }

        const typedPayload = payload as AdminStudyRespondentsPayload;
        setRespondentsData(typedPayload);
        setRespondentPage(typedPayload.responsePage ?? page);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(ADMIN_STORAGE_KEY, normalizedCode);
        }
      } catch (fetchError) {
        setRespondentsData(null);
        setRespondentsError(fetchError instanceof Error ? fetchError.message : 'Impossible de charger les répondants.');
      } finally {
        setRespondentsLoading(false);
      }
    },
    [respondentFilters.beta, respondentFilters.launch, respondentFilters.profile, respondentFilters.search],
  );

  useEffect(() => {
    const savedCode = window.localStorage.getItem(ADMIN_STORAGE_KEY) ?? '';
    if (savedCode) {
      setCodeInput(savedCode);
      void loadDashboard(savedCode);
    }
  }, [loadDashboard]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    await loadDashboard(codeInput);
    setSubmitting(false);
  }

  async function handleRefresh() {
    if (!adminCode) {
      return;
    }

    setSubmitting(true);
    await loadDashboard(adminCode);
    if (respondentsVisible) {
      await loadRespondents(adminCode, respondentPage);
    }
    setSubmitting(false);
  }

  async function handleOpenRespondents() {
    if (!adminCode) {
      return;
    }

    setRespondentsVisible(true);
    setRespondentPage(1);
    await loadRespondents(adminCode, 1);
  }

  async function handleApplyRespondentFilters() {
    if (!adminCode) {
      return;
    }

    setRespondentsVisible(true);
    setRespondentPage(1);
    await loadRespondents(adminCode, 1);
  }

  async function handleRespondentPageChange(nextPage: number) {
    if (!adminCode || nextPage < 1) {
      return;
    }

    setRespondentsVisible(true);
    await loadRespondents(adminCode, nextPage);
  }

  const metrics = data?.metrics;
  const studyStats = data?.studyStats;
  const qualityStats = data?.qualityStats;
  const totalResponses = studyStats?.totalResponses ?? metrics?.totalResponses ?? 0;
  const questionnaireInterestRate = totalResponses > 0 ? ((metrics?.intentCounts.high ?? 0) + (metrics?.intentCounts.medium ?? 0)) / totalResponses : 0;
  const nonListedRoleBreakdown = studyStats?.currentRoleOtherBreakdown ?? [];
  const nonListedRoleTop10 = nonListedRoleBreakdown.slice(0, 10);
  const nonListedRoleDistinctCount = studyStats?.currentRoleOtherDistinctCount ?? 0;
  const nonListedRoleResponseCount = studyStats?.currentRoleOtherResponseCount ?? 0;
  const taxonomyIntegrationCount = nonListedRoleBreakdown.filter((item) => item.count >= 3).length;

  const profileBreakdown = useMemo(
    () =>
      studyStats
        ? sortBreakdown([
            {
              value: 'professional_available',
              label: getProfileLabel('professional_available'),
              count: studyStats.byProfile.professional_available,
            },
            {
              value: 'professional_employed',
              label: getProfileLabel('professional_employed'),
              count: studyStats.byProfile.professional_employed,
            },
            { value: 'company', label: getProfileLabel('company'), count: studyStats.byProfile.company },
            { value: 'agency', label: getProfileLabel('agency'), count: studyStats.byProfile.agency },
          ]).map((item) => ({
            ...item,
            rate: totalResponses > 0 ? item.count / totalResponses : 0,
          }))
        : [],
    [studyStats, totalResponses],
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_24px_80px_-40px_rgba(2,6,23,0.95)] backdrop-blur">
          <div className="flex flex-col gap-5 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <ToneBadge tone="cyan">SEVENO</ToneBadge>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">Admin</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  Lecture des réponses collectées sur la landing privée.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value)}
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Code admin"
                className="min-w-0 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 sm:w-44"
              />
              <button
                type="submit"
                disabled={loading || submitting}
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-cyan-950/20 transition hover:from-cyan-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {adminCode ? 'Ouvrir' : 'Accéder'}
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={!adminCode || loading || submitting}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-cyan-400/40 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Actualiser
              </button>
            </form>
          </div>
        </header>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {!metrics ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300 shadow-[0_24px_80px_-40px_rgba(2,6,23,0.95)]">
            {loading ? 'Chargement du dashboard...' : 'Entrez le code admin pour afficher les statistiques.'}
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <SectionCard
              tone="cyan"
              eyebrow="Résultats de l’étude"
              title="Vue d’ensemble des réponses"
              description="Agrégation réalisée uniquement côté admin, sans exposer les contacts dans les statistiques."
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <KpiCard
                  tone="cyan"
                  label="Réponses collectées"
                  value={totalResponses}
                  detail="Volume total de participation."
                />
                <KpiCard
                  tone="cyan"
                  label="Prévenus du lancement"
                  value={studyStats?.wantsLaunchNotification.true ?? 0}
                  detail={
                    <span>
                      {totalResponses ? formatPercent((studyStats?.wantsLaunchNotification.true ?? 0) / totalResponses) : '0 %'} oui
                      {' / '}
                      {totalResponses ? formatPercent((studyStats?.wantsLaunchNotification.false ?? 0) / totalResponses) : '0 %'} non
                    </span>
                  }
                />
                <KpiCard
                  tone="cyan"
                  label="Bêta intéressés"
                  value={studyStats?.wantsBetaAccess.true ?? 0}
                  detail={
                    <span>
                      {totalResponses ? formatPercent((studyStats?.wantsBetaAccess.true ?? 0) / totalResponses) : '0 %'} oui
                      {' / '}
                      {totalResponses ? formatPercent((studyStats?.wantsBetaAccess.false ?? 0) / totalResponses) : '0 %'} non
                    </span>
                  }
                />
                <KpiCard
                  tone="teal"
                  label="Disponibilité fraîche"
                  value={studyStats ? formatPercent(studyStats.dailyAvailabilityAcceptanceRate) : '0 %'}
                  detail={`${studyStats?.dailyAvailabilityAcceptanceCount ?? 0} réponses acceptées`}
                />
                <KpiCard
                  tone="violet"
                  label="Taux d'intérêt questionnaire"
                  value={metrics ? formatPercent(questionnaireInterestRate) : '0 %'}
                  detail={
                    <span>
                      {metrics?.intentCounts.high ?? 0} High / {metrics?.intentCounts.medium ?? 0} Medium /{' '}
                      {metrics?.intentCounts.low ?? 0} Low
                      {' · '}
                      base {totalResponses}
                    </span>
                  }
                />
                <KpiCard
                  tone="cyan"
                  label="Avis sur le logo"
                  value={metrics ? formatPercent(metrics.logoFeedbackRate) : '0 %'}
                  detail={
                    <span>
                      {metrics?.logoFeedbackBaseCount
                        ? `${formatPercent(metrics.logoFeedbackYesCount / metrics.logoFeedbackBaseCount)} oui / ${formatPercent(metrics.logoFeedbackNoCount / metrics.logoFeedbackBaseCount)} non`
                        : '0 % oui / 0 % non'}
                      {' · '}
                      base {metrics?.logoFeedbackBaseCount ?? 0}
                    </span>
                  }
                />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-sm text-slate-300">Taux de conversion lancement</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{metrics ? formatPercent(metrics.launchRate) : '0 %'}</p>
                  <p className="mt-2 text-sm text-slate-400">{metrics?.launchCount ?? 0} personnes</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-sm text-slate-300">Taux de conversion bêta</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{metrics ? formatPercent(metrics.betaRate) : '0 %'}</p>
                  <p className="mt-2 text-sm text-slate-400">{metrics?.betaCount ?? 0} personnes</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-sm text-slate-300">Intent global</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-xl border border-white/10 bg-slate-900/70 px-2 py-3">
                      <div className="font-semibold text-white">{metrics?.intentCounts.high ?? 0}</div>
                      <div className="mt-1 text-slate-400">High</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-900/70 px-2 py-3">
                      <div className="font-semibold text-white">{metrics?.intentCounts.medium ?? 0}</div>
                      <div className="mt-1 text-slate-400">Medium</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-900/70 px-2 py-3">
                      <div className="font-semibold text-white">{metrics?.intentCounts.low ?? 0}</div>
                      <div className="mt-1 text-slate-400">Low</div>
                    </div>
                  </div>
                </article>
              </div>
            </SectionCard>

            <SectionCard
              tone="cyan"
              eyebrow="Acquisition"
              title="Origine des répondants"
              description="Priorité au UTM lorsqu'il existe, sinon à la réponse de découverte renseignée en fin de parcours."
            >
              <BreakdownTable
                tone="cyan"
                title="Canaux d'acquisition"
                items={studyStats?.byAcquisitionSource ?? []}
                total={totalResponses}
              />
            </SectionCard>

            <div className="grid gap-6 xl:grid-cols-2">
              <SectionCard
                tone="violet"
                eyebrow="Segmentation profils"
                title="Répartition par profil"
                description="Lecture des profils répondants pour comparer les segments principaux."
              >
                <div className="space-y-3">
                  {profileBreakdown.map((item) => (
                    <div key={item.value} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-white">{item.label}</p>
                          <p className="mt-1 text-sm text-slate-400">{formatShare(item.count, totalResponses)} des réponses</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-semibold text-white">{item.count}</p>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.value}</p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400"
                          style={{ width: `${Math.min(100, Math.max(0, (item.rate ?? 0) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                tone="green"
                eyebrow="Marché / secteurs / zone"
                title="Lecture marché"
                description="Répartition des secteurs, zones et habitudes de travail les plus déclarées."
              >
                <div className="grid gap-4">
                  <BreakdownTable tone="green" title="Secteurs" items={studyStats?.bySectorCode ?? []} total={totalResponses} />
                  <BreakdownTable
                    tone="green"
                    title="Zones géographiques"
                    items={studyStats?.byActiveZoneCode ?? []}
                    total={totalResponses}
                  />
                  <BreakdownTable
                    tone="green"
                    title="Types de contrat"
                    items={studyStats?.topContractTypeCodes ?? []}
                    total={totalResponses}
                  />
                  <BreakdownTable
                    tone="green"
                    title="Modes de travail"
                    items={studyStats?.topWorkModePreferenceCodes ?? []}
                    total={totalResponses}
                  />
                </div>
              </SectionCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <SectionCard
                tone="orange"
                eyebrow="Freins / problèmes"
                title="Ce qui bloque le plus"
                description="Lecture synthétique des freins exprimés et des difficultés de marché."
              >
                <div className="grid gap-4">
                  <BreakdownTable
                    tone="orange"
                    title="Freins à la recherche"
                    items={studyStats?.topSearchBlockerCodes ?? []}
                    total={totalResponses}
                  />
                  <BreakdownTable
                    tone="orange"
                    title="Ce qui manque au marché"
                    items={studyStats?.topMarketMissingCodes ?? []}
                    total={totalResponses}
                  />
                </div>
              </SectionCard>

              <SectionCard
                tone="amber"
                eyebrow="Attentes / valeur"
                title="Valeur perçue et attente produit"
                description="Ce que les répondants veulent réellement obtenir de Seveno et du marché en général."
              >
                <div className="grid gap-4">
                  <BreakdownTable
                    tone="amber"
                    title="Valeur attendue"
                    items={studyStats?.topValueExpectationCodes ?? []}
                    total={totalResponses}
                  />
                  <BreakdownTable
                    tone="amber"
                    title="Canal de contact préféré"
                    items={studyStats?.preferredContactChannel ?? []}
                    total={totalResponses}
                  />
                </div>
              </SectionCard>
            </div>

            <SectionCard
              tone="teal"
              eyebrow="Disponibilité fraîche"
              title="Acceptation de la confirmation quotidienne"
              description="Le taux d’acceptation mesure la disposition à confirmer sa disponibilité une fois par jour."
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
                <BreakdownTable
                  tone="teal"
                  title="Confirmation quotidienne"
                  items={studyStats?.dailyAvailabilityConfirmation ?? []}
                  total={totalResponses}
                />

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-sm text-slate-300">Taux d’acceptation quotidienne</p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight text-white">
                    {studyStats ? formatPercent(studyStats.dailyAvailabilityAcceptanceRate) : '0 %'}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    Calculé à partir des réponses favorables à une confirmation quotidienne, sans exposer les contacts.
                  </p>

                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between rounded-xl bg-slate-950/70 px-4 py-3">
                      <span className="text-sm text-slate-300">Réponses acceptées</span>
                      <span className="text-sm font-medium text-white">{studyStats?.dailyAvailabilityAcceptanceCount ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-slate-950/70 px-4 py-3">
                      <span className="text-sm text-slate-300">Base totale</span>
                      <span className="text-sm font-medium text-white">{totalResponses}</span>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              tone="orange"
              eyebrow="Contrôle qualité des réponses"
              title="Détection des réponses suspectes"
              description="Alerte uniquement, sans exposer d'emails, de téléphones ni d'identifiants."
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  tone="orange"
                  label="Emails uniques"
                  value={qualityStats?.uniqueEmails ?? 0}
                  detail="Valeurs non vides détectées."
                />
                <KpiCard
                  tone="orange"
                  label="Téléphones uniques"
                  value={qualityStats?.uniquePhones ?? 0}
                  detail="Valeurs normalisées détectées."
                />
                <KpiCard
                  tone="orange"
                  label="Fingerprints uniques"
                  value={qualityStats?.uniqueFingerprints ?? 0}
                  detail="Empreintes navigateur distinctes."
                />
                <KpiCard
                  tone="orange"
                  label="Réponses suspectes"
                  value={qualityStats?.suspectResponses ?? 0}
                  detail="Doublons ou rafales de soumission."
                />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-sm text-slate-300">Doublons email</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{qualityStats?.duplicateEmailResponses ?? 0}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-sm text-slate-300">Doublons téléphone</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{qualityStats?.duplicatePhoneResponses ?? 0}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-sm text-slate-300">Doublons fingerprint</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{qualityStats?.duplicateFingerprintResponses ?? 0}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-sm text-slate-300">Rafales &lt; 10 min</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{qualityStats?.burstResponses ?? 0}</p>
                </article>
              </div>
            </SectionCard>

            <SectionCard
              tone="amber"
              eyebrow="Enrichissement de taxonomie"
              title="Métiers non listés"
              description="Métiers saisis librement par les répondants lorsqu'ils n'ont pas trouvé leur poste dans la taxonomie actuelle."
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  tone="amber"
                  label="Métiers libres distincts"
                  value={nonListedRoleDistinctCount}
                  detail="Libellés normalisés avant agrégation."
                />
                <KpiCard
                  tone="amber"
                  label="Réponses concernées"
                  value={nonListedRoleResponseCount}
                  detail="Réponses contenant currentRoleOther."
                />
                <KpiCard
                  tone="amber"
                  label="À intégrer"
                  value={taxonomyIntegrationCount}
                  detail="Occurrences ≥ 3."
                />
                <KpiCard
                  tone="amber"
                  label="Résumé"
                  value="Top 10"
                  detail="Métiers libres les plus fréquents."
                />
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_320px]">
                <BreakdownTable
                  tone="amber"
                  title="Top 10 des métiers libres les plus fréquents"
                  items={nonListedRoleTop10}
                  total={nonListedRoleResponseCount}
                  highlightThreshold={3}
                />

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-sm text-slate-300">Lecture rapide</p>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                    <p>Les libellés sont normalisés par trim, espaces multiples et casse avant agrégation.</p>
                    <p>Les entrées répétées signalées ici sont des candidates à une validation admin.</p>
                    <p>Le seuil d&apos;alerte est fixé à 3 occurrences.</p>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              tone="slate"
              eyebrow="Réponses individuelles / répondants"
              title="Répondants"
              description="Consultation à la demande uniquement, avec recherche, filtres et pagination."
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="flex flex-wrap gap-2">
                  {respondentsVisible ? (
                    <button
                      type="button"
                      onClick={() => void loadRespondents(adminCode, respondentPage)}
                      disabled={respondentsLoading}
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-cyan-400/40 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {respondentsLoading ? 'Chargement...' : 'Recharger'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleOpenRespondents()}
                    disabled={!adminCode || respondentsLoading}
                    className="rounded-xl bg-gradient-to-r from-slate-100 to-slate-300 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:from-white hover:to-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {respondentsVisible ? 'Rafraîchir les répondants' : 'Charger les répondants'}
                  </button>
                </div>
              </div>

              {!respondentsVisible ? (
                <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400">
                  Les réponses individuelles restent masquées tant que vous ne les ouvrez pas.
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleApplyRespondentFilters();
                    }}
                    className="grid gap-3 xl:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))_auto]"
                  >
                    <label className="flex flex-col gap-1 text-sm text-slate-300 xl:col-span-1">
                      Recherche
                      <input
                        value={respondentFilters.search}
                        onChange={(event) =>
                          setRespondentFilters((previous) => ({
                            ...previous,
                            search: event.target.value,
                          }))
                        }
                        placeholder="Rechercher une réponse"
                        className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-sm text-slate-300">
                      Profil
                      <select
                        value={respondentFilters.profile}
                        onChange={(event) =>
                          setRespondentFilters((previous) => ({
                            ...previous,
                            profile: event.target.value as 'all' | RespondentType,
                          }))
                        }
                        className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                      >
                        {profileOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1 text-sm text-slate-300">
                      Liste d&apos;attente
                      <select
                        value={respondentFilters.launch}
                        onChange={(event) =>
                          setRespondentFilters((previous) => ({
                            ...previous,
                            launch: event.target.value as FilterValue,
                          }))
                        }
                        className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                      >
                        {yesNoOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1 text-sm text-slate-300">
                      Bêta-testeur
                      <select
                        value={respondentFilters.beta}
                        onChange={(event) =>
                          setRespondentFilters((previous) => ({
                            ...previous,
                            beta: event.target.value as FilterValue,
                          }))
                        }
                        className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                      >
                        {yesNoOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="flex items-end gap-2 xl:col-span-1">
                      <button
                        type="submit"
                        disabled={respondentsLoading}
                        className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2.5 text-sm font-medium text-white transition hover:from-cyan-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Appliquer
                      </button>
                    </div>
                  </form>

                  {respondentsError ? (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                      {respondentsError}
                    </div>
                  ) : null}

                  {respondentsLoading && !respondentsData ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400">
                      Chargement des répondants...
                    </div>
                  ) : null}

                  {respondentsData ? (
                    <>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-400">{respondentsData.responseCount} réponse(s) trouvée(s)</p>
                        <p className="text-sm text-slate-400">
                          Page {respondentsData.responsePage} sur {respondentsData.responseTotalPages || 1}
                        </p>
                      </div>

                      <div className="space-y-3">
                        {respondentsData.responses.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400">
                            Aucune réponse ne correspond aux filtres.
                          </div>
                        ) : (
                          respondentsData.responses.map((response) => {
                            const record = toStudyRecord(response);
                            const summary = getAnsweredSummary(record, 3);
                            const contactLines = [response.email, response.phone].filter(Boolean);

                            return (
                              <article
                                key={response.id}
                                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_16px_60px_-36px_rgba(2,6,23,0.85)]"
                              >
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-white">
                                      {getProfileLabel(response.respondentType)}
                                    </p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                                      {formatDateTime(response.createdAtMs)}
                                    </p>
                                  </div>
                                <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                                    {response.source ? (
                                      <RespondentChip
                                        label="Origine"
                                        value={getAcquisitionSourceLabel(response.source)}
                                        tone="cyan"
                                      />
                                    ) : null}
                                    {response.logoFeedback ? (
                                      <RespondentChip label="Logo" value={response.logoFeedback === 'yes' ? 'Oui' : 'Non'} />
                                    ) : null}
                                    <RespondentChip
                                      label="Lancement"
                                      value={getBooleanLabel(response.wantsLaunchNotification)}
                                      tone={response.wantsLaunchNotification ? 'cyan' : 'slate'}
                                    />
                                    <RespondentChip
                                      label="Bêta"
                                      value={getBooleanLabel(response.wantsBetaAccess)}
                                      tone={response.wantsBetaAccess ? 'violet' : 'slate'}
                                    />
                                  </div>
                                </div>

                                {contactLines.length > 0 ? (
                                  <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-300">
                                    {response.email ? <RespondentChip label="Email" value={response.email} /> : null}
                                    {response.phone ? <RespondentChip label="Téléphone" value={response.phone} /> : null}
                                  </div>
                                ) : null}

                                <div className="mt-4 grid gap-2 text-sm leading-6 text-slate-200">
                                  {summary.length > 0 ? (
                                    summary.map((line) => <p key={line}>{line}</p>)
                                  ) : (
                                    <p className="text-slate-400">Réponse sans détail exploitable.</p>
                                  )}
                                </div>

                                {response.answers && Object.keys(response.answers).length > 0 ? (
                                  <div className="mt-4 flex flex-wrap gap-2">
                                    {Object.entries(response.answers).map(([key, value]) => (
                                      <span
                                        key={key}
                                        className="inline-flex rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-200"
                                      >
                                        {key}: {formatStudyAnswerValue(key, value ?? null)}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </article>
                            );
                          })
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                        <button
                          type="button"
                          onClick={() => void handleRespondentPageChange(Math.max(1, (respondentsData.responsePage ?? 1) - 1))}
                          disabled={respondentsLoading || (respondentsData.responsePage ?? 1) <= 1}
                          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-cyan-400/40 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Précédent
                        </button>
                        <p className="text-sm text-slate-400">10 réponses par page</p>
                        <button
                          type="button"
                          onClick={() =>
                            void handleRespondentPageChange(
                              Math.min(
                                respondentsData.responseTotalPages || 1,
                                (respondentsData.responsePage ?? 1) + 1,
                              ),
                            )
                          }
                          disabled={
                            respondentsLoading ||
                            (respondentsData.responseTotalPages || 1) <= (respondentsData.responsePage ?? 1)
                          }
                          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-cyan-400/40 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Suivant
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </SectionCard>
          </div>
        )}
      </div>
    </main>
  );
}
