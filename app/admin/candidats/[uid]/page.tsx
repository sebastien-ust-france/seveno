'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { findFamilyLabel, findRoleLabel, findSectorLabel } from '@/lib/job-taxonomy';
import { fetchSevenoAdminApi } from '@/lib/seveno-admin-api';
import type { AdminCandidateDetailPayload, AdminCandidateSummary, AdminMatchRequestSummary } from '@/types/seveno-admin';

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

function PrivateField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-white">{value && value.trim() ? value : 'Non renseigne'}</p>
    </article>
  );
}

export default function AdminCandidateDetailPage() {
  const params = useParams<{ uid: string }>();
  const uid = typeof params.uid === 'string' ? params.uid : '';
  const [data, setData] = useState<AdminCandidateDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCandidateDetail = useCallback(async () => {
    if (!uid) {
      throw new Error('Identifiant candidat manquant.');
    }

    const payload = await fetchSevenoAdminApi<AdminCandidateDetailPayload>(`/api/admin/candidates/${uid}`);
    setData(payload);
  }, [uid]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await loadCandidateDetail();
        if (!active) {
          return;
        }

        setLoading(false);
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : 'La fiche privee candidat n a pas pu etre chargee.');
        setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadCandidateDetail]);

  async function handleStatusChange(profileStatus: 'draft' | 'active' | 'paused') {
    if (!uid) {
      setError('Identifiant candidat manquant.');
      return;
    }

    setSavingUid(uid);
    setError(null);

    try {
      await fetchSevenoAdminApi<AdminCandidateSummary>(`/api/admin/candidates/${uid}`, {
        method: 'PATCH',
        body: JSON.stringify({ profileStatus }),
      });
      await loadCandidateDetail();
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La mise a jour du profil candidat a echoue.');
    } finally {
      setSavingUid(null);
    }
  }

  const candidate = data?.candidate ?? null;
  const user = data?.user ?? null;
  const latestTestResult = data?.latestTestResult ?? null;
  const recentMatchRequests = data?.recentMatchRequests ?? [];

  return (
    <SevenoSurface
      eyebrow="Administration Seven'O"
      title="Fiche privee candidat"
      description="Cette vue combine le profil anonymise et les donnees privees du compte candidat. L acces est journalise dans admin_logs."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/candidats"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
          >
            Retour aux candidats
          </Link>
        </div>
      }
      containerClassName="max-w-7xl"
    >
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Administration', href: '/admin' },
            { label: 'Candidats', href: '/admin/candidats' },
            { label: 'Fiche privée' },
          ]}
        />

        {loading ? (
          <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
            Chargement de la fiche privee...
          </SevenoPanel>
        ) : error ? (
          <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">
            {error}
          </SevenoPanel>
        ) : candidate ? (
          <>
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <SevenoPanel tone="cyan" className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                      Identifiant public
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">{candidate.publicCandidateId}</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      Le profil anonyme reste visible cote entreprise, sans aucune identite privee.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                      {candidate.profileStatus}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                      {candidate.testPassed ? `${candidate.verifiedScore ?? 0}%` : 'Test non valide'}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Secteur</p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {findSectorLabel(candidate.sectorId) ?? candidate.sectorId}
                    </p>
                  </article>
                  <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Famille</p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {findFamilyLabel(candidate.jobFamilyId) ?? candidate.jobFamilyId}
                    </p>
                  </article>
                  <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Metier</p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {findRoleLabel(candidate.jobRoleId) ?? candidate.jobRoleId}
                    </p>
                  </article>
                  <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Zone</p>
                    <p className="mt-2 text-sm font-medium text-white">{candidate.locationArea}</p>
                  </article>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleStatusChange('active')}
                    disabled={savingUid === uid || candidate.profileStatus === 'active'}
                    className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingUid === uid && candidate.profileStatus !== 'active' ? 'Mise a jour...' : 'Activer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleStatusChange('paused')}
                    disabled={savingUid === uid || candidate.profileStatus === 'paused'}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingUid === uid && candidate.profileStatus !== 'paused'
                      ? 'Mise a jour...'
                      : 'Mettre en pause'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleStatusChange('draft')}
                    disabled={savingUid === uid || candidate.profileStatus === 'draft'}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingUid === uid && candidate.profileStatus !== 'draft'
                      ? 'Mise a jour...'
                      : 'Repasser en brouillon'}
                  </button>
                </div>
              </SevenoPanel>

              <SevenoPanel tone="violet" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Identite privee</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Compte utilisateur et donnees privees</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Ces donnees proviennent du compte `users/{params.uid}` et restent invisibles cote entreprise.
                </p>

                <div className="mt-5 grid gap-3">
                  <PrivateField label="Email" value={data?.privateIdentity?.email ?? user?.email ?? null} />
                  <PrivateField label="Nom affiche" value={user?.displayName ?? null} />
                  <PrivateField label="Photo Google" value={user?.photoURL ?? null} />
                  <PrivateField label="Telephone" value={data?.privateIdentity?.phone ?? null} />
                  <PrivateField label="CV" value={data?.privateIdentity?.cvUrl ?? null} />
                  <PrivateField label="LinkedIn" value={data?.privateIdentity?.linkedinUrl ?? null} />
                </div>

                <div className="mt-5 rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
                  <p className="font-medium text-white">Journalisation</p>
                  <p className="mt-3">
                    L ouverture de cette fiche privee doit etre tracee. L API serveur cree automatiquement une entree
                    `admin_logs` a chaque consultation.
                  </p>
                </div>
              </SevenoPanel>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <SevenoPanel tone="orange" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Dernier test</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Verification de competence</h2>

                {latestTestResult ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Score</p>
                      <p className="mt-2 text-lg font-semibold text-white">{latestTestResult.score}%</p>
                    </article>
                    <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Resultat</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {latestTestResult.passed ? 'Reussi' : 'Echoue'}
                      </p>
                    </article>
                    <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Question bank</p>
                      <p className="mt-2 text-sm font-medium text-white">{latestTestResult.questionBankCode}</p>
                    </article>
                    <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Verifie le</p>
                      <p className="mt-2 text-sm font-medium text-white">{formatDateTime(latestTestResult.verifiedAt)}</p>
                    </article>
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-slate-300">Aucun resultat de test disponible pour ce candidat.</p>
                )}
              </SevenoPanel>

              <SevenoPanel tone="neutral" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Demandes</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Dernieres mises en relation</h2>
                <div className="mt-4 space-y-3">
                  {recentMatchRequests.length > 0 ? (
                    recentMatchRequests.map((request: AdminMatchRequestSummary) => (
                      <article key={request.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">{request.companyNameSnapshot}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">{request.status}</p>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                            {request.publicCandidateId}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">
                          {request.proposedJobTitle ?? request.jobRoleId} - {request.proposedLocation ?? 'A definir'}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">Creee {formatDateTime(request.createdAt)}</p>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Aucune demande de mise en relation pour ce candidat.</p>
                  )}
                </div>
              </SevenoPanel>
            </div>
          </>
        ) : (
          <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
            Aucun profil candidat trouve pour cet identifiant.
          </SevenoPanel>
        )}
      </div>
    </SevenoSurface>
  );
}
