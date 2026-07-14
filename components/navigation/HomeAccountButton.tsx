'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCurrentAuthUser } from '@/lib/auth';
import { getSevenoUser } from '@/lib/seveno-users';
import type { UserRole } from '@/types/seveno';

type AccountButtonState =
  | {
      status: 'loading';
    }
  | {
      status: 'anonymous';
    }
  | {
      status: 'authenticated';
      href: '/candidat' | '/entreprise' | '/admin';
    };

function resolveAccountHref(role: UserRole): '/candidat' | '/entreprise' | '/admin' {
  switch (role) {
    case 'candidate':
      return '/candidat';
    case 'company':
      return '/entreprise';
    case 'admin':
    default:
      return '/admin';
  }
}

function getIdleClasses() {
  return 'inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020817] sm:w-auto';
}

function getInteractiveClasses() {
  return 'inline-flex w-full items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/30 hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020817] sm:w-auto';
}

export function HomeAccountButton() {
  const [state, setState] = useState<AccountButtonState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    async function resolveAccountState() {
      try {
        const authUser = await getCurrentAuthUser();
        if (!active) {
          return;
        }

        if (!authUser) {
          setState({ status: 'anonymous' });
          return;
        }

        const sevenoUser = await getSevenoUser(authUser.uid);
        if (!active) {
          return;
        }

        if (
          sevenoUser?.role === 'candidate'
          || sevenoUser?.role === 'company'
          || sevenoUser?.role === 'admin'
        ) {
          setState({
            status: 'authenticated',
            href: resolveAccountHref(sevenoUser.role),
          });
          return;
        }

        setState({ status: 'anonymous' });
      } catch {
        if (!active) {
          return;
        }

        setState({ status: 'anonymous' });
      }
    }

    void resolveAccountState();

    return () => {
      active = false;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <span aria-busy="true" aria-live="polite" className={getIdleClasses()}>
        Chargement...
      </span>
    );
  }

  const label = state.status === 'authenticated' ? 'Retour à mon compte' : 'S’inscrire ou se connecter';
  const href = state.status === 'authenticated' ? state.href : '/connexion';

  return (
    <Link href={href} className={state.status === 'authenticated' ? getInteractiveClasses() : getIdleClasses()}>
      {label}
    </Link>
  );
}
