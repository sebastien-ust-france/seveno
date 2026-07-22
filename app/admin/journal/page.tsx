'use client';

import { useEffect, useState } from 'react';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { fetchSevenoAdminApi } from '@/lib/seveno-admin-api';
import type { AdminLogSummary } from '@/types/seveno-admin';

type LogsPayload = {
  logs: AdminLogSummary[];
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

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AdminLogSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const payload = await fetchSevenoAdminApi<LogsPayload>('/api/admin/journal');
        if (!active) {
          return;
        }

        setLogs(payload.logs);
        setLoading(false);
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : 'Le journal admin n a pas pu etre charge.');
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
      title="Journal admin"
      description="Tracabilite des acces sensibles et des changements de statut. Les vues privees candidat doivent toujours laisser une trace."
      containerClassName="max-w-7xl"
    >
      <div className="space-y-6">
        {loading ? (
          <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
            Chargement du journal admin...
          </SevenoPanel>
        ) : error ? (
          <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">
            {error}
          </SevenoPanel>
        ) : (
          <SevenoPanel tone="neutral" className="p-5">
            <div className="space-y-3">
              {logs.length > 0 ? (
                logs.map((entry) => (
                  <article key={entry.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{entry.action}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                          {entry.actorRole ?? 'admin'} - {entry.actorUserId ?? 'inconnu'}
                        </p>
                      </div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{formatDateTime(entry.createdAt)}</p>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-300 md:grid-cols-2">
                      <p>Collection: {entry.targetCollection ?? 'Non renseignee'}</p>
                      <p>Identifiant cible: {entry.targetId ?? 'Non renseigne'}</p>
                    </div>

                    {entry.metadata ? (
                      <pre className="mt-4 overflow-x-auto rounded-[16px] border border-white/10 bg-slate-950/70 p-4 text-xs leading-6 text-slate-300">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="text-sm text-slate-400">Aucune entree de journal disponible.</p>
              )}
            </div>
          </SevenoPanel>
        )}
      </div>
    </SevenoSurface>
  );
}
