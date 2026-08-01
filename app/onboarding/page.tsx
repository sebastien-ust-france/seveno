'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCurrentAuthUser, signOutUser } from '@/lib/auth';
import { hasCandidateProfile } from '@/lib/seveno-candidates';
import { hasCompanyProfile } from '@/lib/seveno-companies';
import {
  ensureSevenoUser,
  getSevenoUser,
  resolveSevenoRedirect,
  COMPANY_INVITE_ONLY_MESSAGE,
  updateSevenoUserRole,
} from '@/lib/seveno-users';
import type { SevenoUser } from '@/types/seveno';

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SevenoUser | null>(null);
  const [savingCandidateRole, setSavingCandidateRole] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const authUser = await getCurrentAuthUser();

        if (!active) {
          return;
        }

        if (!authUser) {
          router.replace('/connexion');
          return;
        }

        const ensured = await ensureSevenoUser(authUser);
        const currentUser = (await getSevenoUser(ensured.uid)) ?? ensured;

        if (!active) {
          return;
        }

        if (currentUser.role) {
          if (currentUser.role === 'candidate') {
            const profileExists = await hasCandidateProfile(currentUser.uid);

            if (!active) {
              return;
            }

            if (profileExists) {
              router.replace('/candidat');
              return;
            }

            router.replace('/candidat/onboarding');
            return;
          }

          if (currentUser.role === 'company') {
            const profileExists = await hasCompanyProfile(currentUser.uid);

            if (!active) {
              return;
            }

            router.replace(profileExists ? '/entreprise' : '/entreprise/onboarding');
            return;
          }

          router.replace(resolveSevenoRedirect(currentUser));
          return;
        }

        setUser(currentUser);
        setLoading(false);
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : "L onboarding n a pas pu etre charge.");
        setLoading(false);
      }
    }

    void loadUser();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleCandidateSelection() {
    if (!user) {
      return;
    }

    setSavingCandidateRole(true);
    setError(null);

    try {
      const updatedUser = await updateSevenoUserRole(user.uid, 'candidate');
      router.replace(resolveSevenoRedirect(updatedUser));
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : "Le rôle candidat n a pas pu etre enregistré.");
    } finally {
      setSavingCandidateRole(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOutUser();
      router.replace('/connexion');
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La déconnexion a échoué.');
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.14),transparent_30%),linear-gradient(180deg,#020617_0%,#020817_45%,#020617_100%)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-5 py-10 sm:px-8">
        <section className="w-full max-w-2xl rounded-[32px] border border-violet-400/10 bg-[linear-gradient(180deg,rgba(12,14,34,0.96),rgba(8,15,28,0.94))] p-6 shadow-[0_24px_90px_rgba(2,6,23,0.42)] backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-200/80">Choix du rôle</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">Qui représentez-vous ?</h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
                Le rôle est choisi après la première connexion. Le rôle administrateur n’est pas proposé publiquement.
              </p>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
                {COMPANY_INVITE_ONLY_MESSAGE}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
            >
              Se déconnecter
            </button>
          </div>

          {loading ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
              Vérification de votre compte...
            </div>
          ) : (
            <div className="mt-8 grid gap-4">
              <button
                type="button"
                onClick={() => void handleCandidateSelection()}
                disabled={savingCandidateRole}
                className="group rounded-[24px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.96),rgba(8,15,28,0.92))] p-5 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Candidat</p>
                <h2 className="mt-3 text-xl font-semibold text-white">Je suis candidat</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Vous souhaitez construire votre profil anonyme et préparer vos prochaines étapes.
                </p>
                <span className="mt-5 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100">
                  {savingCandidateRole ? 'Enregistrement...' : 'Continuer'}
                </span>
              </button>
            </div>
          )}

          {error ? (
            <p className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <Link href="/" className="transition hover:text-white">
              Retour à l accueil
            </Link>
            <span className="hidden h-1 w-1 rounded-full bg-slate-600 sm:inline-block" />
            <Link href="/connexion" className="transition hover:text-white">
              Connexion
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
