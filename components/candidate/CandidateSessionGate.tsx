'use client';

import type { ReactNode } from 'react';
import { useSevenoCandidateSession } from '@/lib/use-seveno-candidate-session';
import { AuthenticatedAppShell } from '@/components/navigation/AuthenticatedAppShell';
import { CandidateSidebarIdentity } from '@/components/navigation/CandidateSidebarIdentity';
import { CANDIDATE_NAVIGATION } from '@/lib/seveno-navigation';
import {
  resolveCandidateSessionGateState,
  shouldRenderCandidateChildren,
} from '@/lib/seveno-candidate-session-gate';

type CandidateSessionGateProps = {
  children: ReactNode;
};

function CandidateSessionStatusScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_28%),linear-gradient(180deg,#020617_0%,#020817_45%,#020617_100%)] text-white">
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div
          role="status"
          aria-live="polite"
          className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,32,0.96),rgba(8,15,28,0.9))] p-6 text-center shadow-[0_24px_90px_rgba(2,6,23,0.34)] sm:p-8"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Seven’O</p>
          <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-200 border-t-transparent" aria-hidden="true" />
          </div>
          <p className="mt-5 text-xl font-semibold text-white">{message}</p>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Vérification de votre session en cours. Le tableau de bord apparaîtra dès que votre accès sera confirmé.
          </p>
        </div>
      </div>
    </div>
  );
}

export function CandidateSessionGate({ children }: CandidateSessionGateProps) {
  const { authUser, loading, error } = useSevenoCandidateSession();
  const gateState = resolveCandidateSessionGateState({ loading, authUser, error });

  if (!shouldRenderCandidateChildren(gateState)) {
    return (
      <CandidateSessionStatusScreen
        message={
          gateState === 'error'
            ? error ?? 'La vérification de votre session a échoué.'
            : 'Vérification de votre session…'
        }
      />
    );
  }

  return (
    <AuthenticatedAppShell
      eyebrow="Espace candidat"
      title=""
      description=""
      navigation={CANDIDATE_NAVIGATION}
      role="candidate"
      sidebarTop={<CandidateSidebarIdentity />}
    >
      {children}
    </AuthenticatedAppShell>
  );
}
