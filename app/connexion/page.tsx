'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from 'firebase/auth';
import {
  createEmailPasswordUser,
  deleteAuthUser,
  getCurrentAuthUser,
  getEmailSignInMethods,
  isPasswordAuthUser,
  refreshAuthUser,
  sendPasswordReset,
  sendVerificationEmail,
  signInWithEmailPassword,
  signInWithGoogle,
  signOutUser,
} from '@/lib/auth';
import { ensureSevenoUser, resolveSevenoRedirect } from '@/lib/seveno-users';
import type { PublicUserRole, SevenoUser } from '@/types/seveno';

type AuthMode = 'sign-in' | 'sign-up' | 'reset';
type LoadingAction = 'google' | 'sign-in' | 'sign-up' | 'reset' | 'resend' | 'refresh' | 'sign-out' | null;

type PendingVerification = {
  authUser: User;
  sevenoUser: SevenoUser;
};

function getFirebaseErrorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code ?? 'unknown')
    : 'unknown';
}

function getSafeAuthError(error: unknown, context: AuthMode | 'google' | 'verification') {
  const code = getFirebaseErrorCode(error);

  switch (code) {
    case 'auth/invalid-email':
      return 'Saisissez une adresse email valide.';
    case 'auth/weak-password':
      return 'Le mot de passe est trop faible. Utilisez au moins 8 caractères.';
    case 'auth/email-already-in-use':
      return 'Cette adresse est déjà associée à un compte. Connectez-vous avec votre méthode habituelle, notamment Google si vous l’avez utilisée.';
    case 'auth/account-exists-with-different-credential':
      return 'Cette adresse utilise déjà une autre méthode de connexion. Utilisez la méthode choisie lors de votre inscription.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Adresse email ou mot de passe incorrect.';
    case 'auth/popup-closed-by-user':
      return 'La fenêtre Google a été fermée avant la fin de la connexion.';
    case 'auth/popup-blocked':
      return 'Le navigateur a bloqué la fenêtre Google. Autorisez les fenêtres contextuelles puis réessayez.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives ont été effectuées. Patientez quelques minutes avant de réessayer.';
    case 'auth/network-request-failed':
      return 'La connexion au service d’authentification a échoué. Vérifiez votre réseau.';
    case 'auth/operation-not-allowed':
      return 'Cette méthode de connexion n’est pas encore activée dans Firebase Authentication.';
    case 'auth/requires-recent-login':
      return 'Reconnectez-vous avant de renouveler cette action.';
    default:
      if (context === 'google') return 'La connexion Google a échoué. Réessayez.';
      if (context === 'verification') return 'L’email de vérification n’a pas pu être envoyé. Réessayez.';
      if (context === 'sign-up') return 'La création du compte a échoué. Réessayez.';
      return 'La connexion a échoué. Réessayez.';
  }
}

function isEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function ConnexionPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [selectedRole, setSelectedRole] = useState<PublicUserRole>('candidate');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
  const busy = loadingAction !== null;

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const authUser = await getCurrentAuthUser();
        if (!active) return;

        if (!authUser) {
          setCheckingSession(false);
          return;
        }

        const sevenoUser = await ensureSevenoUser(authUser);
        if (!active) return;

        if (isPasswordAuthUser(authUser) && !authUser.emailVerified) {
          setEmail(authUser.email ?? sevenoUser.email);
          setPendingVerification({ authUser, sevenoUser });
          setCheckingSession(false);
          return;
        }

        router.replace(resolveSevenoRedirect(sevenoUser));
      } catch (thrownError) {
        if (!active) return;
        console.error('Vérification de session SevenO échouée', {
          code: getFirebaseErrorCode(thrownError),
          error: thrownError,
        });
        setError(getSafeAuthError(thrownError, 'sign-in'));
        setCheckingSession(false);
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  function selectMode(nextMode: AuthMode) {
    if (busy) return;
    setMode(nextMode);
    setError(null);
    setNotice(null);
    setPassword('');
    setPasswordConfirmation('');
  }

  function handleAuthenticatedUser(authUser: User, sevenoUser: SevenoUser) {
    if (isPasswordAuthUser(authUser) && !authUser.emailVerified) {
      setPendingVerification({ authUser, sevenoUser });
      setEmail(authUser.email ?? sevenoUser.email);
      setNotice('Votre adresse email doit être vérifiée. Vous pouvez néanmoins continuer votre onboarding.');
      return;
    }

    router.replace(resolveSevenoRedirect(sevenoUser));
  }

  async function handleGoogleSignIn() {
    if (busy) return;
    setLoadingAction('google');
    setError(null);
    setNotice(null);

    try {
      const authUser = await signInWithGoogle();
      const sevenoUser = await ensureSevenoUser(authUser);
      router.replace(resolveSevenoRedirect(sevenoUser));
    } catch (thrownError) {
      console.error('Connexion Google SevenO échouée', {
        code: getFirebaseErrorCode(thrownError),
        error: thrownError,
      });
      setError(getSafeAuthError(thrownError, 'google'));
      setLoadingAction(null);
    }
  }

  async function handleEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!isEmailAddress(normalizedEmail)) {
      setError('Saisissez une adresse email valide.');
      return;
    }
    if (!password) {
      setError('Saisissez votre mot de passe.');
      return;
    }

    setLoadingAction('sign-in');
    setError(null);
    setNotice(null);

    try {
      const authUser = await signInWithEmailPassword(normalizedEmail, password);
      const sevenoUser = await ensureSevenoUser(authUser);
      handleAuthenticatedUser(authUser, sevenoUser);
    } catch (thrownError) {
      console.error('Connexion email SevenO échouée', {
        code: getFirebaseErrorCode(thrownError),
        error: thrownError,
      });
      setError(getSafeAuthError(thrownError, 'sign-in'));
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleEmailSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!isEmailAddress(normalizedEmail)) {
      setError('Saisissez une adresse email valide.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('La confirmation du mot de passe ne correspond pas.');
      return;
    }

    setLoadingAction('sign-up');
    setError(null);
    setNotice(null);
    let createdAuthUser: User | null = null;

    try {
      const methods = await getEmailSignInMethods(normalizedEmail);
      if (methods.includes('google.com')) {
        setError('Cette adresse est déjà associée à Google. Utilisez « Continuer avec Google ».');
        return;
      }
      if (methods.length > 0) {
        setError('Cette adresse est déjà associée à un compte. Connectez-vous avec votre méthode habituelle.');
        return;
      }

      createdAuthUser = await createEmailPasswordUser(normalizedEmail, password);

      let sevenoUser: SevenoUser;
      try {
        sevenoUser = await ensureSevenoUser(createdAuthUser, selectedRole);
      } catch (userDocumentError) {
        await deleteAuthUser(createdAuthUser).catch(() => undefined);
        createdAuthUser = null;
        throw userDocumentError;
      }

      try {
        await sendVerificationEmail(createdAuthUser);
        setNotice('Compte créé. Un email de vérification vient de vous être envoyé.');
      } catch (verificationError) {
        console.error('Envoi initial de vérification SevenO échoué', {
          code: getFirebaseErrorCode(verificationError),
          error: verificationError,
        });
        setNotice('Compte créé. L’email de vérification n’a pas pu être envoyé ; utilisez le bouton de renvoi ci-dessous.');
      }

      setPendingVerification({ authUser: createdAuthUser, sevenoUser });
      setPassword('');
      setPasswordConfirmation('');
    } catch (thrownError) {
      console.error('Création de compte email SevenO échouée', {
        code: getFirebaseErrorCode(thrownError),
        error: thrownError,
      });
      setError(getSafeAuthError(thrownError, 'sign-up'));
    } finally {
      setLoadingAction(null);
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!isEmailAddress(normalizedEmail)) {
      setError('Saisissez une adresse email valide.');
      return;
    }

    setLoadingAction('reset');
    setError(null);
    setNotice(null);

    try {
      await sendPasswordReset(normalizedEmail);
    } catch (thrownError) {
      console.error('Demande de réinitialisation SevenO terminée avec une erreur Firebase', {
        code: getFirebaseErrorCode(thrownError),
        error: thrownError,
      });
    } finally {
      setNotice('Si cette adresse correspond à un compte email SevenO, un lien de réinitialisation a été envoyé.');
      setLoadingAction(null);
    }
  }

  async function handleResendVerification() {
    if (!pendingVerification || busy) return;
    setLoadingAction('resend');
    setError(null);
    setNotice(null);

    try {
      await sendVerificationEmail(pendingVerification.authUser);
      setNotice('Un nouvel email de vérification a été envoyé.');
    } catch (thrownError) {
      console.error('Renvoi de vérification SevenO échoué', {
        code: getFirebaseErrorCode(thrownError),
        error: thrownError,
      });
      setError(getSafeAuthError(thrownError, 'verification'));
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleRefreshVerification() {
    if (!pendingVerification || busy) return;
    setLoadingAction('refresh');
    setError(null);
    setNotice(null);

    try {
      const authUser = await refreshAuthUser(pendingVerification.authUser);
      const sevenoUser = await ensureSevenoUser(authUser);
      if (!authUser.emailVerified) {
        setError('L’adresse email n’est pas encore vérifiée. Ouvrez le lien reçu puis réessayez.');
        return;
      }

      router.replace(resolveSevenoRedirect(sevenoUser));
    } catch (thrownError) {
      console.error('Actualisation de la vérification SevenO échouée', {
        code: getFirebaseErrorCode(thrownError),
        error: thrownError,
      });
      setError(getSafeAuthError(thrownError, 'verification'));
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleUseAnotherAccount() {
    if (busy) return;
    setLoadingAction('sign-out');
    setError(null);

    try {
      await signOutUser();
      setPendingVerification(null);
      setNotice(null);
      setPassword('');
      setPasswordConfirmation('');
      setMode('sign-in');
    } catch (thrownError) {
      setError(getSafeAuthError(thrownError, 'sign-in'));
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_28%),linear-gradient(180deg,#020617_0%,#020817_45%,#020617_100%)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-5 py-10 sm:px-8">
        <section className="w-full max-w-2xl rounded-[32px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.96),rgba(8,15,28,0.94))] p-6 shadow-[0_24px_90px_rgba(2,6,23,0.42)] backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">Accès Seven’O</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">Connexion ou création de compte</h1>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
              Firebase Auth
            </span>
          </div>

          {checkingSession ? (
            <div className="mt-7 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
              Vérification de votre session en cours...
            </div>
          ) : pendingVerification ? (
            <div className="mt-7 space-y-5">
              <div className="rounded-[24px] border border-amber-300/20 bg-amber-400/10 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">Email non vérifié</p>
                <h2 className="mt-3 text-xl font-semibold text-white">Vérifiez {pendingVerification.sevenoUser.email}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Vous pouvez continuer votre onboarding. L’activation publique d’un profil candidat et les fonctionnalités
                  entreprise restent limitées jusqu’à la vérification de cette adresse.
                </p>
              </div>

              {notice ? <p className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">{notice}</p> : null}
              {error ? <p role="alert" className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void handleRefreshVerification()}
                  disabled={busy}
                  className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingAction === 'refresh' ? 'Vérification...' : 'J’ai vérifié mon email'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleResendVerification()}
                  disabled={busy}
                  className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingAction === 'resend' ? 'Envoi...' : 'Renvoyer l’email'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => router.replace(resolveSevenoRedirect(pendingVerification.sevenoUser))}
                disabled={busy}
                className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continuer vers mon onboarding
              </button>
              <button
                type="button"
                onClick={() => void handleUseAnotherAccount()}
                disabled={busy}
                className="w-full text-sm text-slate-400 transition hover:text-white disabled:opacity-60"
              >
                {loadingAction === 'sign-out' ? 'Déconnexion...' : 'Utiliser un autre compte'}
              </button>
            </div>
          ) : (
            <div className="mt-7 space-y-6">
              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                disabled={busy}
                className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-6 py-4 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loadingAction === 'google' ? 'Connexion Google...' : 'Continuer avec Google'}
              </button>

              <div className="flex items-center gap-4 text-xs uppercase tracking-[0.22em] text-slate-500">
                <span className="h-px flex-1 bg-white/10" />
                ou par email
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <div className="grid grid-cols-2 rounded-full border border-white/10 bg-slate-950/60 p-1">
                <button
                  type="button"
                  onClick={() => selectMode('sign-in')}
                  disabled={busy}
                  className={`rounded-full px-4 py-3 text-sm font-semibold transition ${mode === 'sign-in' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Se connecter
                </button>
                <button
                  type="button"
                  onClick={() => selectMode('sign-up')}
                  disabled={busy}
                  className={`rounded-full px-4 py-3 text-sm font-semibold transition ${mode === 'sign-up' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Créer un compte
                </button>
              </div>

              {mode === 'reset' ? (
                <form className="space-y-4" onSubmit={(event) => void handlePasswordReset(event)}>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Mot de passe oublié</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">Saisissez votre adresse pour recevoir un lien de réinitialisation.</p>
                  </div>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-200">Adresse email</span>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingAction === 'reset' ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
                  </button>
                  <button type="button" onClick={() => selectMode('sign-in')} disabled={busy} className="w-full text-sm text-slate-400 transition hover:text-white">
                    Retour à la connexion
                  </button>
                </form>
              ) : (
                <form className="space-y-4" onSubmit={(event) => void (mode === 'sign-up' ? handleEmailSignUp(event) : handleEmailSignIn(event))}>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-200">Adresse email</span>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-200">Mot de passe</span>
                    <span className="flex rounded-2xl border border-white/10 bg-slate-950/70 focus-within:border-cyan-300/40">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        minLength={mode === 'sign-up' ? 8 : undefined}
                        required
                        className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="px-4 text-xs font-semibold text-cyan-200 transition hover:text-white"
                        aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      >
                        {showPassword ? 'Masquer' : 'Afficher'}
                      </button>
                    </span>
                  </label>

                  {mode === 'sign-up' ? (
                    <>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-200">Confirmer le mot de passe</span>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={passwordConfirmation}
                          onChange={(event) => setPasswordConfirmation(event.target.value)}
                          minLength={8}
                          required
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                        />
                      </label>

                      <fieldset className="space-y-3">
                        <legend className="text-sm font-medium text-slate-200">Votre profil</legend>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {([
                            { value: 'candidate' as const, label: 'Candidat' },
                            { value: 'company' as const, label: 'Entreprise' },
                          ]).map((option) => (
                            <label key={option.value} className={`cursor-pointer rounded-2xl border p-4 text-sm transition ${selectedRole === option.value ? 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                              <input
                                type="radio"
                                name="profile-role"
                                value={option.value}
                                checked={selectedRole === option.value}
                                onChange={() => setSelectedRole(option.value)}
                                className="mr-3 accent-cyan-400"
                              />
                              {option.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </>
                  ) : null}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingAction === 'sign-up'
                      ? 'Création du compte...'
                      : loadingAction === 'sign-in'
                        ? 'Connexion...'
                        : mode === 'sign-up'
                          ? 'Créer mon compte'
                          : 'Se connecter avec une adresse email'}
                  </button>

                  {mode === 'sign-in' ? (
                    <button type="button" onClick={() => selectMode('reset')} disabled={busy} className="w-full text-sm text-slate-400 transition hover:text-white">
                      Mot de passe oublié
                    </button>
                  ) : null}
                </form>
              )}

              {notice ? <p className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">{notice}</p> : null}
              {error ? <p role="alert" className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <Link href="/" className="transition hover:text-white">Retour à l’accueil</Link>
            <span className="hidden h-1 w-1 rounded-full bg-slate-600 sm:inline-block" />
            <Link href="/etude" className="transition hover:text-white">Participer à l’étude</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
