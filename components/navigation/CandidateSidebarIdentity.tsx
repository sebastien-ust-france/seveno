'use client';

import { useEffect, useState } from 'react';
import { getCurrentAuthUser } from '@/lib/auth';

type CandidateSidebarIdentityState = {
  loading: boolean;
  email: string | null;
  emailVerified: boolean;
  photoURL: string | null;
};

export function CandidateSidebarIdentity() {
  const [state, setState] = useState<CandidateSidebarIdentityState>({
    loading: true,
    email: null,
    emailVerified: false,
    photoURL: null,
  });

  useEffect(() => {
    let active = true;

    async function loadIdentity() {
      try {
        const authUser = await getCurrentAuthUser();
        if (!active) {
          return;
        }

        setState({
          loading: false,
          email: authUser?.email ?? null,
          emailVerified: authUser?.emailVerified ?? false,
          photoURL: authUser?.photoURL ?? null,
        });
      } catch {
        if (!active) {
          return;
        }

        setState({
          loading: false,
          email: null,
          emailVerified: false,
          photoURL: null,
        });
      }
    }

    void loadIdentity();

    return () => {
      active = false;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col gap-3">
          <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-white/10" />
            <div className="h-6 w-24 animate-pulse rounded-full bg-white/10" />
          </div>
          <div className="h-3 w-full max-w-[14rem] animate-pulse rounded-full bg-white/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgb(var(--seveno-brand-blue)/0.12),rgba(249,115,22,0.10))]">
            {state.photoURL ? (
              // Google photo URLs are user-specific and cannot rely on a fixed Next.js image allowlist.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.photoURL}
                alt="Photo de profil"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6 text-cyan-100">
                <path d="M20 21a8 8 0 0 0-16 0" strokeLinecap="round" />
                <circle cx="12" cy="8" r="4" />
              </svg>
            )}
          </div>

          <span
            className={[
              'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
              state.emailVerified
                ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
                : 'border-amber-300/20 bg-amber-400/10 text-amber-100',
            ].join(' ')}
          >
            {state.emailVerified ? 'Email vérifié' : 'Email non vérifié'}
          </span>
        </div>

        <p className="break-words text-sm font-medium leading-6 text-white">
          {state.email ?? 'Email indisponible'}
        </p>
      </div>
    </div>
  );
}
