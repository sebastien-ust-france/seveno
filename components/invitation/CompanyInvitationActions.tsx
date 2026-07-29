'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type InvitationAction = 'sign-up' | 'sign-in';

interface CompanyInvitationActionsProps {
  token: string;
  invitationEmailMasked: string;
}

function getInvitationActionLabel(action: InvitationAction) {
  return action === 'sign-up' ? 'Créer mon compte entreprise' : 'J’ai déjà un compte';
}

export function CompanyInvitationActions({
  token,
  invitationEmailMasked,
}: CompanyInvitationActionsProps) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<InvitationAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOpenConnexion(action: InvitationAction) {
    if (loadingAction) {
      return;
    }

    setLoadingAction(action);
    setError(null);

    try {
      const response = await fetch('/api/seveno/company-invitations/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ token }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            message?: string;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.message?.trim() || 'Cette invitation n’est plus utilisable.');
      }

      router.push(`/connexion?companyInvitationAction=${action}`);
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Cette invitation n’est plus utilisable.');
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <p className="text-sm leading-7 text-slate-300">
        Cette invitation est réservée à {invitationEmailMasked}. Utilisez uniquement cette adresse pour créer ou ouvrir le compte entreprise.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {(['sign-up', 'sign-in'] as const).map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => void handleOpenConnexion(action)}
            disabled={Boolean(loadingAction)}
            className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingAction === action ? 'Préparation...' : getInvitationActionLabel(action)}
          </button>
        ))}
      </div>
    </div>
  );
}
