'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { fetchSevenoAdminApi } from '@/lib/seveno-admin-api';
import type {
  AdminPrerequisiteSuggestionDetailPayload,
  AdminPrerequisiteSuggestionSummary,
  AdminPrerequisiteSuggestionUsageSummary,
} from '@/types/seveno-admin';

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Non disponible';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Non disponible';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatCount(value: number) {
  return value.toLocaleString('fr-FR');
}

function formatContextList(items: Array<{ id: string; label: string }>) {
  if (items.length === 0) {
    return 'Aucun';
  }

  const labels = items.slice(0, 4).map((item) => item.label);
  const suffix = items.length > 4 ? '...' : '';
  return `${labels.join(', ')}${suffix}`;
}

function UsageCard({ usage }: { usage: AdminPrerequisiteSuggestionUsageSummary }) {
  return (
    <article className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Usage</p>
          <h3 className="mt-2 text-base font-semibold text-white">
            {usage.sectorLabel} - {usage.jobFamilyLabel} - {usage.jobRoleLabel}
          </h3>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
          {usage.importance === 'required' ? 'Obligatoire' : 'Valeur ajoutee'}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Secteur</p>
          <p className="mt-2 text-sm text-white">{usage.sectorLabel}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Famille</p>
          <p className="mt-2 text-sm text-white">{usage.jobFamilyLabel}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Metier</p>
          <p className="mt-2 text-sm text-white">{usage.jobRoleLabel}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Etat</p>
          <p className="mt-2 text-sm text-white">{usage.active ? 'Actif' : 'Inactif'}</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-300">
        Créé le {formatDateTime(usage.createdAt)}
        {' '}
        - maj le {formatDateTime(usage.updatedAt)}
        {usage.endedAt ? ` - termine le ${formatDateTime(usage.endedAt)}` : ''}
      </p>
    </article>
  );
}

function SuggestionSummaryCard({ item, canonicalLabel }: { item: AdminPrerequisiteSuggestionSummary; canonicalLabel: string | null }) {
  return (
    <SevenoPanel tone="neutral" className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Suggestion privee</p>
          <h2 className="text-2xl font-semibold text-white">{item.label}</h2>
          <p className="text-sm leading-6 text-slate-300">
            Identifiant normalise: <span className="font-medium text-slate-100">{item.normalizedLabel}</span>
          </p>
          <p className="text-sm leading-6 text-slate-300">
            Premiere detection: {formatDateTime(item.firstSeenAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
            {item.statusLabel}
          </span>
          {canonicalLabel ? (
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
              {canonicalLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Utilisations</p>
          <p className="mt-2 text-lg font-semibold text-white">{formatCount(item.usageCount)}</p>
        </article>
        <article className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Entreprises</p>
          <p className="mt-2 text-lg font-semibold text-white">{formatCount(item.companyCount)}</p>
        </article>
        <article className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Obligatoires</p>
          <p className="mt-2 text-lg font-semibold text-white">{formatCount(item.requiredCount)}</p>
        </article>
        <article className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Valeur ajoutee</p>
          <p className="mt-2 text-lg font-semibold text-white">{formatCount(item.preferredCount)}</p>
        </article>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <article className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Secteurs observes</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{formatContextList(item.observedSectors)}</p>
        </article>
        <article className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Familles observees</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{formatContextList(item.observedFamilies)}</p>
        </article>
        <article className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Metiers observes</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{formatContextList(item.observedRoles)}</p>
        </article>
      </div>
    </SevenoPanel>
  );
}

export default function AdminPrerequisiteSuggestionDetailPage() {
  const params = useParams<{ suggestionId?: string | string[] }>();
  const routeSuggestionId = params?.suggestionId;
  const suggestionId = Array.isArray(routeSuggestionId) ? routeSuggestionId[0] : routeSuggestionId ?? '';
  const [data, setData] = useState<AdminPrerequisiteSuggestionDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      if (!suggestionId) {
        setError('Suggestion introuvable.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const payload = await fetchSevenoAdminApi<AdminPrerequisiteSuggestionDetailPayload>(
          `/api/admin/prerequisite-suggestions/${encodeURIComponent(suggestionId)}`,
        );
        if (cancelled) {
          return;
        }

        setData(payload);
      } catch (thrownError) {
        if (cancelled) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : 'Le detail de la suggestion n a pas pu etre charge.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [suggestionId]);

  return (
    <SevenoSurface
      eyebrow="Administration Seven’O"
      title="Detail de suggestion privee"
      description="Lecture seule. Ce niveau affiche le detail anonymise d une suggestion, sans identite entreprise ni offre source."
      containerClassName="max-w-7xl"
    >
      <div className="space-y-6">
        <SevenoPanel tone="neutral" className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Navigation</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Retour et consultation</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Les donnees sensibles restent masquees dans cette fiche.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/prerequis/suggestions"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
            >
              Retour a la file
            </Link>
            <Link
              href="/admin/prerequis"
              className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Bibliotheque des prerequis
            </Link>
          </div>
        </SevenoPanel>

        {error ? (
          <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">
            {error}
          </SevenoPanel>
        ) : null}

        {loading ? (
          <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
            Chargement du detail...
          </SevenoPanel>
        ) : data?.suggestion ? (
          <>
            <SuggestionSummaryCard item={data.suggestion} canonicalLabel={data.canonicalPrerequisiteLabel} />

            <SevenoPanel tone="neutral" className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Usages observes</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {data.usages.length > 0
                      ? `${formatCount(data.usages.length)} ${data.usages.length > 1 ? 'usages affichés' : 'usage affiché'} sur ${formatCount(data.usageLimit)} maximum.`
                      : 'Aucun usage ne correspond a cette suggestion.'}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                  {data.hasMoreUsages ? 'Suite disponible' : 'Toutes les occurrences affichees'}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {data.usages.length > 0 ? (
                  data.usages.map((usage) => <UsageCard key={usage.id} usage={usage} />)
                ) : (
                  <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
                    Aucun usage detaille disponible.
                  </SevenoPanel>
                )}
              </div>
            </SevenoPanel>
          </>
        ) : (
          <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
            Aucune suggestion disponible.
          </SevenoPanel>
        )}
      </div>
    </SevenoSurface>
  );
}
