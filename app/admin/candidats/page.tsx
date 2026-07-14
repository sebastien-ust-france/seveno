'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { findFamilyLabel, findRoleLabel, findSectorLabel } from '@/lib/job-taxonomy';
import { fetchSevenoAdminApi } from '@/lib/seveno-admin-api';
import type { AdminCandidateSummary } from '@/types/seveno-admin';

type CandidatesPayload = {
  candidates: AdminCandidateSummary[];
};

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

export default function AdminCandidatesPage() {
  const [data, setData] = useState<AdminCandidateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCandidates() {
    const payload = await fetchSevenoAdminApi<CandidatesPayload>('/api/admin/candidates');
    setData(payload.candidates);
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await loadCandidates();
        if (!active) {
          return;
        }

        setLoading(false);
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : 'Les candidats n ont pas pu etre charges.');
        setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  async function handleStatusChange(uid: string, profileStatus: 'draft' | 'active' | 'paused') {
    setSavingUid(uid);
    setError(null);

    try {
      await fetchSevenoAdminApi<{ candidate: AdminCandidateSummary }>(`/api/admin/candidates/${uid}`, {
        method: 'PATCH',
        body: JSON.stringify({ profileStatus }),
      });
      await loadCandidates();
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La mise a jour du profil candidat a echoue.');
    } finally {
      setSavingUid(null);
    }
  }

  return (
    <SevenoSurface
      eyebrow="Administration Seven'O"
      title="Candidats"
      description="Les profils ici sont anonymises. Aucune identite privee ne doit etre visible dans cette liste."
      containerClassName="max-w-7xl"
    >
      <div className="space-y-6">
        {loading ? (
          <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
            Chargement des profils candidats...
          </SevenoPanel>
        ) : error ? (
          <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">
            {error}
          </SevenoPanel>
        ) : (
          <div className="space-y-4">
            {data.length > 0 ? (
              data.map((candidate) => {
                const sectorLabel = findSectorLabel(candidate.sectorId) ?? candidate.sectorId;
                const familyLabel = findFamilyLabel(candidate.jobFamilyId) ?? candidate.jobFamilyId;
                const roleLabel = findRoleLabel(candidate.jobRoleId) ?? candidate.jobRoleId;

                return (
                  <SevenoPanel key={candidate.uid} tone="neutral" className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                            Identifiant public
                          </p>
                          <h2 className="mt-2 text-xl font-semibold text-white">{candidate.publicCandidateId}</h2>
                        </div>

                        <p className="text-sm leading-6 text-slate-300">
                          {sectorLabel} - {familyLabel} - {roleLabel}
                        </p>
                        <p className="text-sm leading-6 text-slate-300">
                          Zone: {candidate.locationArea} - Experience: {candidate.experienceLevel}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                          {candidate.profileStatus}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                          {candidate.testPassed ? `${candidate.verifiedScore ?? 0}% verifie` : 'Test non valide'}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                          Maj {formatDateTime(candidate.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Metier cible</p>
                        <p className="mt-2 text-sm font-medium text-white">{roleLabel}</p>
                      </article>
                      <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Secteur</p>
                        <p className="mt-2 text-sm font-medium text-white">{sectorLabel}</p>
                      </article>
                      <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Famille</p>
                        <p className="mt-2 text-sm font-medium text-white">{familyLabel}</p>
                      </article>
                      <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Score verifie</p>
                        <p className="mt-2 text-sm font-medium text-white">
                          {candidate.verifiedScore != null ? `${candidate.verifiedScore}%` : 'Non disponible'}
                        </p>
                      </article>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <Link
                        href={`/admin/candidats/${candidate.uid}`}
                        className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                      >
                        Ouvrir la fiche privee
                      </Link>

                      <button
                        type="button"
                        onClick={() => void handleStatusChange(candidate.uid, 'active')}
                        disabled={savingUid === candidate.uid || candidate.profileStatus === 'active'}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingUid === candidate.uid && candidate.profileStatus !== 'active'
                          ? 'Mise a jour...'
                          : 'Activer'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleStatusChange(candidate.uid, 'paused')}
                        disabled={savingUid === candidate.uid || candidate.profileStatus === 'paused'}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingUid === candidate.uid && candidate.profileStatus !== 'paused'
                          ? 'Mise a jour...'
                          : 'Mettre en pause'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleStatusChange(candidate.uid, 'draft')}
                        disabled={savingUid === candidate.uid || candidate.profileStatus === 'draft'}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingUid === candidate.uid && candidate.profileStatus !== 'draft'
                          ? 'Mise a jour...'
                          : 'Repasser en brouillon'}
                      </button>
                    </div>
                  </SevenoPanel>
                );
              })
            ) : (
              <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
                Aucun profil candidat disponible.
              </SevenoPanel>
            )}
          </div>
        )}
      </div>
    </SevenoSurface>
  );
}
