'use client';

import { useEffect, useState } from 'react';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { fetchSevenoAdminApi } from '@/lib/seveno-admin-api';
import type { AdminTestResultSummary, AdminTestSessionSummary } from '@/types/seveno-admin';

type TestsPayload = {
  sessions: AdminTestSessionSummary[];
  results: AdminTestResultSummary[];
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

export default function AdminTestsPage() {
  const [sessions, setSessions] = useState<AdminTestSessionSummary[]>([]);
  const [results, setResults] = useState<AdminTestResultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const payload = await fetchSevenoAdminApi<TestsPayload>('/api/admin/tests');
        if (!active) {
          return;
        }

        setSessions(payload.sessions);
        setResults(payload.results);
        setLoading(false);
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : 'Les donnees de test n ont pas pu etre chargees.');
        setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  return (
    <SevenoSurface
      eyebrow="Administration Seven’O"
      title="Tests"
      description="Evaluations historiques - ancien modele. Suivi des sessions de test et des resultats verifies. Aucune donnee privee candidat n est affichee ici."
      containerClassName="max-w-7xl"
    >
      <div className="space-y-6">
        {loading ? (
          <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
            Chargement des tests...
          </SevenoPanel>
        ) : error ? (
          <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">
            {error}
          </SevenoPanel>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            <SevenoPanel tone="neutral" className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Sessions</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Dernieres sessions</h2>
              <div className="mt-4 space-y-3">
                {sessions.length > 0 ? (
                  sessions.map((session) => (
                    <article key={session.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">{session.publicCandidateId}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">{session.status}</p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                          {session.score != null ? `${session.score}%` : 'En attente'}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        {session.questionBankCode} - {session.jobRoleId}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Debut {formatDateTime(session.startedAt)} - Fin {formatDateTime(session.expiresAt)}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">Aucune session disponible.</p>
                )}
              </div>
            </SevenoPanel>

            <SevenoPanel tone="orange" className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Resultats</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Derniers resultats</h2>
              <div className="mt-4 space-y-3">
                {results.length > 0 ? (
                  results.map((result) => (
                    <article key={result.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">{result.publicCandidateId}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                            {result.passed ? 'Reussi' : 'Echoue'}
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                          {result.score}%
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        {result.questionBankCode} - {result.totalQuestions} question(s) - {result.correctAnswers} juste(s)
                      </p>
                      <p className="mt-2 text-xs text-slate-500">Verifie {formatDateTime(result.verifiedAt)}</p>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">Aucun resultat disponible.</p>
                )}
              </div>
            </SevenoPanel>
          </div>
        )}
      </div>
    </SevenoSurface>
  );
}
