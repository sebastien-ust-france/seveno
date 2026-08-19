'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CandidateShell } from '@/components/candidate/CandidateShell';
import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import { respondToAvailabilityRequest } from '@/lib/seveno-candidate-availability-client';
import type { CandidateAvailabilityConfirmationAction } from '@/types/seveno';

export default function CandidateAvailabilityPage() {
  const [requestId, setRequestId] = useState('');
  const [token, setToken] = useState('');
  const [action, setAction] = useState<CandidateAvailabilityConfirmationAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextRequestId = params.get('requestId')?.trim() ?? '';
    const nextToken = params.get('token')?.trim() ?? '';
    const decision = params.get('decision')?.trim();
    const presetAction: CandidateAvailabilityConfirmationAction | null = decision === 'yes' || decision === 'no'
      ? decision
      : null;

    setRequestId(nextRequestId);
    setToken(nextToken);
    setAction(presetAction);
  }, []);

  const canSubmit = Boolean(requestId && token && action);
  const title = action === 'no'
    ? 'Signaler que je ne suis plus disponible'
    : 'Confirmer ma disponibilité';

  async function handleSubmit(nextAction: CandidateAvailabilityConfirmationAction | null = action) {
    if (!requestId || !token || !nextAction) {
      setError('Le lien de confirmation est incomplet.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await respondToAvailabilityRequest({
        requestId,
        token,
        action: nextAction,
        source: 'notification_page',
      });

      setSuccess(
        nextAction === 'yes'
          ? 'Disponibilité confirmée pour 24 heures.'
          : 'Disponibilité immédiate désactivée.',
      );
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La confirmation a échoué.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <CandidateShell
      title={title}
      description="Cette page permet de répondre à la demande de disponibilité sans ouvrir votre tableau de bord."
      footer={<p className="text-xs uppercase tracking-[0.24em] text-slate-500">Seven’O - Disponibilité</p>}
    >
      <div className="space-y-5">
        <SevenoPanel tone="cyan" className="p-5">
          <p className="text-sm leading-7 text-slate-300">
            Seven&apos;O vous demande simplement si vous etes toujours disponible immediatement.
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Une réponse « Oui » confirme votre disponibilité pendant 24 heures. Une réponse « Non » désactive la disponibilité
            immediate.
          </p>
        </SevenoPanel>

        {error ? (
          <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">
            {error}
          </SevenoPanel>
        ) : null}

        {success ? (
          <SevenoPanel tone="cyan" className="p-5 text-sm leading-7 text-cyan-100">
            {success}
            <div className="mt-4">
              <Link href="/candidat" className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15">
                Retour au tableau de bord
              </Link>
            </div>
          </SevenoPanel>
        ) : null}

        {!success ? (
          <SevenoPanel tone="neutral" className="p-5">
            {action ? (
            <button
              type="button"
                onClick={() => void handleSubmit(action)}
                disabled={!canSubmit || loading}
                className="inline-flex rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Validation...' : action === 'yes' ? 'Oui, toujours disponible' : 'Non, plus disponible'}
              </button>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAction('yes');
                    void handleSubmit('yes');
                  }}
                  disabled={!requestId || !token || loading}
                  className="inline-flex rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Oui, toujours disponible
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAction('no');
                    void handleSubmit('no');
                  }}
                  disabled={!requestId || !token || loading}
                  className="inline-flex rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Non, plus disponible
                </button>
              </div>
            )}
          </SevenoPanel>
        ) : null}
      </div>
    </CandidateShell>
  );
}
