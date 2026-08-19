'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { fetchSevenoAdminApi } from '@/lib/seveno-admin-api';
import type {
  AdminPrerequisiteSuggestionListPayload,
  AdminPrerequisiteSuggestionSort,
  AdminPrerequisiteSuggestionSummary,
} from '@/types/seveno-admin';
import type { PrerequisiteSuggestionStatus } from '@/types/seveno-prerequisite-suggestions';

const DEFAULT_LIMIT = 20;
const SORT_OPTIONS: Array<{ value: AdminPrerequisiteSuggestionSort; label: string }> = [
  { value: 'recent', label: 'Plus recentes' },
  { value: 'usageCount', label: 'Plus utilisees' },
  { value: 'companyCount', label: 'Plus partagees' },
];
const STATUS_OPTIONS: Array<{ value: 'all' | PrerequisiteSuggestionStatus; label: string }> = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'pending', label: 'A examiner' },
  { value: 'merged', label: 'Rattachee' },
  { value: 'approved', label: 'Approuvee' },
  { value: 'rejected', label: 'Rejetee' },
];

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

function formatContextList(items: Array<{ id: string; label: string }>) {
  if (items.length === 0) {
    return 'Aucun';
  }

  const labels = items.slice(0, 3).map((item) => item.label);
  const suffix = items.length > 3 ? '...' : '';
  return `${labels.join(', ')}${suffix}`;
}

function renderCount(value: number) {
  return value.toLocaleString('fr-FR');
}

function SuggestionCard({ item }: { item: AdminPrerequisiteSuggestionSummary }) {
  return (
    <SevenoPanel tone="neutral" className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
            File privee
          </p>
          <h3 className="text-xl font-semibold text-white">{item.label}</h3>
          <p className="text-sm leading-6 text-slate-300">
            Identifiant normalise: <span className="font-medium text-slate-100">{item.normalizedLabel}</span>
          </p>
          <p className="text-sm leading-6 text-slate-300">
            Derniere apparition: {formatDateTime(item.lastSeenAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
            {item.statusLabel}
          </span>
          {item.canonicalPrerequisiteCode ? (
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
              {item.canonicalPrerequisiteLabel ?? item.canonicalPrerequisiteCode}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Utilisations</p>
          <p className="mt-2 text-lg font-semibold text-white">{renderCount(item.usageCount)}</p>
        </article>
        <article className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Entreprises</p>
          <p className="mt-2 text-lg font-semibold text-white">{renderCount(item.companyCount)}</p>
        </article>
        <article className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Obligatoires</p>
          <p className="mt-2 text-lg font-semibold text-white">{renderCount(item.requiredCount)}</p>
        </article>
        <article className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Valeur ajoutee</p>
          <p className="mt-2 text-lg font-semibold text-white">{renderCount(item.preferredCount)}</p>
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

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Premiere detection: {formatDateTime(item.firstSeenAt)}
          {' '}
          - Schema v{item.schemaVersion}
        </p>

        <Link
          href={`/admin/prerequis/suggestions/${encodeURIComponent(item.suggestionId)}`}
          className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Voir le detail
        </Link>
      </div>
    </SevenoPanel>
  );
}

export default function AdminPrerequisiteSuggestionsPage() {
  const [items, setItems] = useState<AdminPrerequisiteSuggestionSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PrerequisiteSuggestionStatus>('all');
  const [sort, setSort] = useState<AdminPrerequisiteSuggestionSort>('recent');
  const [searchNonce, setSearchNonce] = useState(0);
  const requestSeq = useRef(0);

  async function fetchSuggestions(options: { append?: boolean; cursor?: string | null } = {}) {
    const append = options.append === true;
    const seq = ++requestSeq.current;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setItems([]);
      setNextCursor(null);
    }
    setError(null);

    try {
      const params = new URLSearchParams({ limit: String(DEFAULT_LIMIT) });
      if (query.trim()) {
        params.set('q', query.trim());
      }
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (sort !== 'recent') {
        params.set('sort', sort);
      }
      if (options.cursor) {
        params.set('cursor', options.cursor);
      }

      const payload = await fetchSevenoAdminApi<AdminPrerequisiteSuggestionListPayload>(
        `/api/admin/prerequisite-suggestions?${params.toString()}`,
      );

      if (seq !== requestSeq.current) {
        return;
      }

      setItems((current) => (append ? [...current, ...payload.items] : payload.items));
      setNextCursor(payload.nextCursor);
    } catch (thrownError) {
      if (seq !== requestSeq.current) {
        return;
      }

      setError(thrownError instanceof Error ? thrownError.message : 'La file privee n a pas pu etre chargee.');
    } finally {
      if (seq !== requestSeq.current) {
        return;
      }

      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void fetchSuggestions();
    // The fetch function intentionally reads the latest filter state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, statusFilter, sort, searchNonce]);

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(searchDraft.trim());
    setSearchNonce((current) => current + 1);
  }

  return (
    <SevenoSurface
      eyebrow="Administration Seven’O"
      title="Suggestions privees de prerequis"
      description="Lecture seule de la file privee remontee par les entreprises. Aucun document n est modifiable depuis le navigateur."
      containerClassName="max-w-7xl"
    >
      <div className="space-y-6">
        <SevenoPanel tone="neutral" className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Consultation</p>
            <h2 className="mt-2 text-lg font-semibold text-white">File privee des suggestions</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Les identites entreprises, les titres d offres et les autres donnees sensibles restent masques.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/prerequis"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
            >
              Retour a la bibliotheque
            </Link>
            <button
              type="button"
              onClick={() => void fetchSuggestions()}
              className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Recharger
            </button>
          </div>
        </SevenoPanel>

        {error ? (
          <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">
            {error}
          </SevenoPanel>
        ) : null}

        <SevenoPanel tone="neutral" className="p-5">
          <form onSubmit={handleSearchSubmit} className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(12rem,0.7fr)_minmax(12rem,0.7fr)_auto]">
            <label className="space-y-2 text-sm text-slate-200">
              Recherche
              <input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                placeholder="Libelle, code ou nom canonique"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-200">
              Statut
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | PrerequisiteSuggestionStatus)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-200">
              Tri
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as AdminPrerequisiteSuggestionSort)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
              >
                Appliquer
              </button>
            </div>
          </form>
        </SevenoPanel>

        <SevenoPanel tone="neutral" className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Resultats</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {items.length > 0
                  ? `${renderCount(items.length)} ${items.length > 1 ? 'suggestions chargées' : 'suggestion chargée'}.`
                  : loading
                    ? 'Chargement des suggestions privees...'
                    : 'Aucune suggestion ne correspond actuellement à ces critères.'}
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
              Tri: {SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Plus recentes'}
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {loading && items.length === 0 ? (
              <p className="text-sm text-slate-400">Chargement...</p>
            ) : items.length > 0 ? (
              items.map((item) => <SuggestionCard key={item.suggestionId} item={item} />)
            ) : (
              <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
                Aucune suggestion privee a afficher.
              </SevenoPanel>
            )}
          </div>

          {nextCursor ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => void fetchSuggestions({ append: true, cursor: nextCursor })}
                disabled={loadingMore}
                className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMore ? 'Chargement...' : 'Charger la suite'}
              </button>
            </div>
          ) : null}
        </SevenoPanel>
      </div>
    </SevenoSurface>
  );
}
