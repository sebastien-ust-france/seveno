'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentAuthUser } from '@/lib/auth';
import {
  acceptSevenoTerms,
  ensureSevenoUser,
  getSevenoTermsAcceptance,
  hasSevenoTermsAcceptance,
  resolveSevenoRedirect,
} from '@/lib/seveno-users';
import type { SevenoUser, TermsAcceptanceContext } from '@/types/seveno';

function formatAcceptanceDate(value: unknown) {
  if (!value || typeof value !== 'object') {
    return 'Non disponible';
  }

  if ('toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format((value as { toDate: () => Date }).toDate());
  }

  return 'Non disponible';
}

function resolveContext(role: SevenoUser['role']): TermsAcceptanceContext | null {
  if (role === 'candidate') {
    return 'candidate_account';
  }

  if (role === 'company') {
    return 'company_first_access';
  }

  return null;
}

export function CguAcceptancePanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authUser, setAuthUser] = useState<Awaited<ReturnType<typeof getCurrentAuthUser>>>(null);
  const [user, setUser] = useState<SevenoUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const currentAuthUser = await getCurrentAuthUser();
        if (!active) {
          return;
        }

        setAuthUser(currentAuthUser);
        if (!currentAuthUser) {
          setLoading(false);
          return;
        }

        const sevenoUser = await ensureSevenoUser(currentAuthUser);
        if (!active) {
          return;
        }

        setUser(sevenoUser);
        const context = resolveContext(sevenoUser.role);
        if (context) {
          setAccepted(hasSevenoTermsAcceptance(sevenoUser, context));
        }
        setLoading(false);
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : 'La verification de votre session a echoue.');
        setLoading(false);
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  const context = useMemo(() => resolveContext(user?.role ?? null), [user?.role]);
  const acceptance = context ? getSevenoTermsAcceptance(user, context) : null;
  async function handleAccept() {
    if (!authUser || !user || !context) {
      router.push('/connexion');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const result = await acceptSevenoTerms(authUser);
      const refreshed = await ensureSevenoUser(authUser);
      const refreshedAcceptance = getSevenoTermsAcceptance(refreshed, context);
      setUser(refreshed);
      setAccepted(true);
      setNotice(
        `CGU version ${refreshedAcceptance?.cguVersion ?? result.acceptance.cguVersion} enregistrées le ${formatAcceptanceDate(refreshedAcceptance?.acceptedAt ?? result.acceptance.acceptedAt)}.`,
      );
      window.setTimeout(() => {
        router.replace(resolveSevenoRedirect(refreshed));
      }, 900);
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : "L'acceptation des CGU a echoue.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[30px] border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.93))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.34)] sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/90">Acceptation</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            {user?.role === 'company'
              ? "Premier accès entreprise"
              : user?.role === 'candidate'
                ? 'Création ou mise à jour du compte candidat'
                : 'Lire et enregistrer les CGU'}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            La version 1.0 des CGU peut être enregistrée avec un horodatage serveur avant la poursuite du parcours.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 print:hidden"
        >
          Imprimer ou enregistrer les CGU
        </button>
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-slate-300">Vérification de votre session...</p>
      ) : error ? (
        <p className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : notice ? (
        <p className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </p>
      ) : !authUser ? (
        <div className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
          <p>Connectez-vous pour enregistrer l’acceptation associée à votre compte.</p>
          <Link
            href="/connexion"
            className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
          >
            Aller à la connexion
          </Link>
        </div>
      ) : user?.role === 'admin' ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
          Ce compte administrateur n’utilise pas le parcours d’acceptation candidat ou entreprise.
        </div>
      ) : context ? (
        <form
          className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300"
          onSubmit={(event) => {
            event.preventDefault();
            void handleAccept();
          }}
        >
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={accepted || Boolean(acceptance)}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-1 accent-cyan-400"
              disabled={Boolean(acceptance)}
            />
            <span>
              {user?.role === 'company'
                ? "Je confirme être habilité à représenter l’entreprise et j’accepte les Conditions générales d’utilisation de Seven’O."
                : "J’ai lu et j’accepte les Conditions générales d’utilisation de Seven’O."}
            </span>
          </label>

          <p className="text-xs leading-6 text-slate-400">
            Le texte « Conditions générales d’utilisation » renvoie à la page juridique complète.
          </p>

          {acceptance ? (
            <p className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              Version {acceptance.cguVersion} enregistrée le {formatAcceptanceDate(acceptance.acceptedAt)}.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving || (!accepted && !acceptance)}
              className="inline-flex rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer mon acceptation'}
            </button>
            <Link
              href="/cgu#article-15"
              className="inline-flex rounded-full border border-white/10 bg-white/5 px-5 py-3 font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Relire l’article sur les recommandations
            </Link>
          </div>
        </form>
      ) : null}
    </section>
  );
}
