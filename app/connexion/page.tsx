'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FirebaseError } from 'firebase/app';
import type { User } from 'firebase/auth';
import {
  createEmailPasswordUser,
  getCurrentAuthUser,
  isPasswordAuthUser,
  refreshAuthUser,
  sendPasswordReset,
  sendVerificationEmail,
  signInWithEmailPassword,
  signInWithGoogle,
  signOutUser,
} from '@/lib/auth';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import { ensureSevenoUser, resolveSevenoRedirect } from '@/lib/seveno-users';
import type { PublicCompanyInvitationView, PublicUserRole, SevenoUser } from '@/types/seveno';

type AuthMode = 'sign-in' | 'sign-up' | 'reset';
type LoadingAction = 'google' | 'sign-in' | 'sign-up' | 'reset' | 'resend' | 'refresh' | 'sign-out' | null;

type PendingVerification = {
  authUser: User;
  sevenoUser: SevenoUser;
};

type GoogleSignInStage = 'popup' | 'token' | 'user_document' | 'redirect';

export const dynamic = 'force-dynamic';

function isFirebaseError(error: unknown): error is FirebaseError {
  return error instanceof FirebaseError;
}

function getFirebaseErrorCode(error: unknown) {
  if (isFirebaseError(error)) {
    return error.code;
  }

  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code ?? 'unknown')
    : 'unknown';
}

function getFirebaseErrorName(error: unknown) {
  return error instanceof Error ? error.name : 'UnknownError';
}

function getFirebaseErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function shouldRedactDiagnosticsKey(key: string) {
  const normalizedKey = key.toLowerCase();

  return [
    'token',
    'credential',
    'secret',
    'password',
    'email',
    'photo',
    'access',
    'refresh',
    'idtoken',
  ].some((fragment) => normalizedKey.includes(fragment));
}

function redactDiagnosticsValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint' || typeof value === 'symbol') {
    return String(value);
  }

  if (typeof value === 'function') {
    return '[Function]';
  }

  if (Array.isArray(value)) {
    if (depth >= 2) {
      return '[Array]';
    }

    return value.map((entry) => redactDiagnosticsValue(entry, depth + 1));
  }

  if (typeof value === 'object') {
    if (depth >= 2) {
      return '[Object]';
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        shouldRedactDiagnosticsKey(key) ? '[redacted]' : redactDiagnosticsValue(entry, depth + 1),
      ]),
    );
  }

  return String(value);
}

function getFirebaseCustomData(error: unknown) {
  if (!error || typeof error !== 'object' || !('customData' in error)) {
    return undefined;
  }

  return redactDiagnosticsValue((error as { customData?: unknown }).customData);
}

function getGoogleSignInDiagnostics(error: unknown, stage: GoogleSignInStage) {
  return {
    stage,
    name: getFirebaseErrorName(error),
    code: getFirebaseErrorCode(error),
    message: getFirebaseErrorMessage(error),
    customData: getFirebaseCustomData(error),
    stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
  };
}

function getGoogleSignInUserMessage(error: unknown, stage: GoogleSignInStage) {
  switch (getFirebaseErrorCode(error)) {
    case 'auth/popup-closed-by-user':
      return 'La fenêtre de connexion Google a été fermée.';
    case 'auth/popup-blocked':
      return 'Chrome a bloqué la fenêtre de connexion Google. Autorisez les fenêtres pop-up pour Seven’O.';
    case 'auth/unauthorized-domain':
      return 'Ce domaine n’est pas autorisé pour la connexion Google.';
    case 'auth/network-request-failed':
      return 'La connexion à Google a échoué. Vérifiez votre connexion Internet.';
    case 'auth/invalid-api-key':
      return 'La configuration Firebase locale est invalide.';
    case 'auth/operation-not-allowed':
      return 'La connexion Google n’est pas activée dans Firebase.';
    default:
      break;
  }

  switch (stage) {
    case 'token':
      return 'La connexion Google a réussi, mais le jeton de session n a pas pu être récupéré.';
    case 'user_document':
      return 'La connexion Google a réussi, mais la synchronisation du compte Seven’O a échoué.';
    case 'redirect':
      return 'La connexion Google a réussi, mais la redirection a échoué.';
    default:
      return 'La connexion Google a échoué. Réessayez.';
  }
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

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

export default function ConnexionPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [signupAccountType, setSignupAccountType] = useState<PublicUserRole | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
  const [currentInvitation, setCurrentInvitation] = useState<PublicCompanyInvitationView | null>(null);
  const [invitationLoading, setInvitationLoading] = useState(true);
  const busy = loadingAction !== null;
  const activeCompanyInvitation = currentInvitation?.status === 'pending';
  const invitationEmailNormalized = currentInvitation?.emailNormalized ?? '';

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const invitationAction = new URLSearchParams(window.location.search).get('companyInvitationAction');
    if (invitationAction === 'sign-up' || invitationAction === 'sign-in') {
      setMode(invitationAction);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadInvitation() {
      try {
        const response = await fetch('/api/seveno/company-invitations/current', {
          cache: 'no-store',
        });
        const payload = (await response.json().catch(() => null)) as
          | { invitation?: PublicCompanyInvitationView | null }
          | null;

        if (!active) return;
        const invitation = payload?.invitation ?? null;
        setCurrentInvitation(invitation);
        if (invitation?.emailNormalized) {
          setEmail((current) => (current.trim() ? current : invitation.emailNormalized));
        }
      } catch {
        if (!active) return;
        setCurrentInvitation(null);
      } finally {
        if (!active) return;
        setInvitationLoading(false);
      }
    }

    void loadInvitation();

    return () => {
      active = false;
    };
  }, []);

  function hasActiveCompanyInvitation() {
    return activeCompanyInvitation;
  }

  function isInvitationEmailMatch(candidateEmail: string) {
    if (!activeCompanyInvitation) {
      return true;
    }

    return normalizeEmail(candidateEmail) === invitationEmailNormalized;
  }

  const acceptCurrentCompanyInvitation = useCallback(
    async (authUser: User) => {
      if (!activeCompanyInvitation) {
        return null;
      }

      const response = await fetchSevenoMatchApi<{
        accepted: boolean;
        redirectPath: string;
      }>(authUser, '/api/seveno/company-invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.redirectPath;
    },
    [activeCompanyInvitation],
  );

  const handleAuthenticatedUser = useCallback(
    async (authUser: User, sevenoUser: SevenoUser) => {
      if (activeCompanyInvitation) {
        const resolvedEmail = normalizeEmail(authUser.email ?? sevenoUser.email);
        if (!resolvedEmail || resolvedEmail !== invitationEmailNormalized) {
          await signOutUser().catch(() => undefined);
          setPendingVerification(null);
          setNotice(null);
          setError('Cette invitation est réservée à une autre adresse email.');
          return;
        }

        if (isPasswordAuthUser(authUser) && !authUser.emailVerified) {
          setPendingVerification({ authUser, sevenoUser });
          setEmail(authUser.email ?? sevenoUser.email);
          setNotice('Votre adresse email doit être vérifiée pour poursuivre la création de votre compte entreprise.');
          return;
        }

        const redirectPath = await acceptCurrentCompanyInvitation(authUser);
        router.replace(redirectPath ?? '/entreprise/onboarding');
        return;
      }

      if (isPasswordAuthUser(authUser) && !authUser.emailVerified) {
        setPendingVerification({ authUser, sevenoUser });
        setEmail(authUser.email ?? sevenoUser.email);
        setNotice('Votre adresse email doit être vérifiée. Vous pouvez néanmoins continuer votre onboarding.');
        return;
      }

      router.replace(resolveSevenoRedirect(sevenoUser));
    },
    [acceptCurrentCompanyInvitation, activeCompanyInvitation, invitationEmailNormalized, router],
  );

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        if (invitationLoading) {
          return;
        }

        const authUser = await getCurrentAuthUser();
        if (!active) return;

        if (!authUser) {
          setCheckingSession(false);
          return;
        }

        const sevenoUser = await ensureSevenoUser(authUser);
        if (!active) return;

        await handleAuthenticatedUser(authUser, sevenoUser);
        if (!active) return;
        setCheckingSession(false);
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
  }, [handleAuthenticatedUser, invitationLoading, currentInvitation?.invitationId]);

  function selectMode(nextMode: AuthMode) {
    if (busy) return;
    setMode(nextMode);
    setError(null);
    setNotice(null);
    setPassword('');
    setPasswordConfirmation('');
  }

  async function handleGoogleSignIn() {
    if (busy) return;
    setLoadingAction('google');
    setError(null);
    setNotice(null);

    let stage: GoogleSignInStage = 'popup';

    try {
      const authUser = await signInWithGoogle();
      stage = 'token';
      try {
        await authUser.getIdToken();
      } catch (tokenError) {
        console.error('Connexion Google SevenO echouee', getGoogleSignInDiagnostics(tokenError, stage));
      }
      stage = 'user_document';
      const sevenoUser = await ensureSevenoUser(authUser);
      stage = 'redirect';
      const redirectPath = hasActiveCompanyInvitation()
        ? '/entreprise/onboarding'
        : resolveSevenoRedirect(sevenoUser);
      console.info('Connexion Google SevenO reussie', {
        stage,
        uid: authUser.uid,
        role: sevenoUser.role,
        redirectPath,
      });
      await handleAuthenticatedUser(authUser, sevenoUser);
    } catch (thrownError) {
      console.error('Connexion Google SevenO echouee', getGoogleSignInDiagnostics(thrownError, stage));
      setError(getGoogleSignInUserMessage(thrownError, stage));
    } finally {
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
      await handleAuthenticatedUser(authUser, sevenoUser);
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
    if (!hasActiveCompanyInvitation() && !signupAccountType) {
      setError('Choisissez comment vous souhaitez utiliser Seven’O.');
      return;
    }

    setLoadingAction('sign-up');
    setError(null);
    setNotice(null);
    let createdAuthUser: User | null = null;

    try {
      if (hasActiveCompanyInvitation() && !isInvitationEmailMatch(normalizedEmail)) {
        setError('Cette invitation est réservée à une autre adresse email.');
        return;
      }

      createdAuthUser = await createEmailPasswordUser(normalizedEmail, password);

      let sevenoUser: SevenoUser;
      try {
        sevenoUser = await ensureSevenoUser(createdAuthUser, hasActiveCompanyInvitation() ? null : signupAccountType);
      } catch (userDocumentError) {
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

      if (hasActiveCompanyInvitation()) {
        const redirectPath = await acceptCurrentCompanyInvitation(authUser);
        router.replace(redirectPath ?? '/entreprise/onboarding');
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
                  {hasActiveCompanyInvitation()
                    ? 'Votre adresse email doit être vérifiée pour poursuivre la création de votre compte entreprise.'
                    : 'Vous pouvez continuer votre onboarding. L’activation publique d’un profil candidat et les fonctionnalités entreprise restent limitées jusqu’à la vérification de cette adresse.'}
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

              {!hasActiveCompanyInvitation() ? (
                <button
                  type="button"
                  onClick={() => router.replace(resolveSevenoRedirect(pendingVerification.sevenoUser))}
                  disabled={busy}
                  className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continuer vers mon onboarding
                </button>
              ) : null}
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
                  {hasActiveCompanyInvitation() ? (
                    <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-4 py-3 text-sm leading-6 text-cyan-50">
                      Une invitation entreprise est active pour {currentInvitation?.emailMasked ?? 'votre adresse'}.
                    </div>
                  ) : null}

                  {mode === 'sign-up' && !hasActiveCompanyInvitation() ? (
                    <fieldset className="space-y-3">
                      <legend className="text-sm font-semibold text-white">Comment souhaitez-vous utiliser Seven’O ?</legend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          aria-pressed={signupAccountType === 'candidate'}
                          onClick={() => setSignupAccountType('candidate')}
                          className={`rounded-2xl border p-4 text-left transition ${signupAccountType === 'candidate' ? 'border-cyan-300/60 bg-cyan-400/15' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                        >
                          <span className="block font-semibold text-white">Je suis candidat</span>
                          <span className="mt-2 block text-sm leading-5 text-slate-300">Je recherche une opportunité professionnelle.</span>
                        </button>
                        <button
                          type="button"
                          aria-pressed={signupAccountType === 'company'}
                          onClick={() => setSignupAccountType('company')}
                          className={`rounded-2xl border p-4 text-left transition ${signupAccountType === 'company' ? 'border-blue-300/60 bg-blue-400/15' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                        >
                          <span className="block font-semibold text-white">Je représente une entreprise</span>
                          <span className="mt-2 block text-sm leading-5 text-slate-300">Je souhaite recruter avec Seven’O.</span>
                        </button>
                      </div>
                    </fieldset>
                  ) : null}

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

                    </>
                  ) : null}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingAction === 'sign-up'
                      ? hasActiveCompanyInvitation()
                        ? 'Création du compte entreprise...'
                        : 'Création du compte...'
                      : loadingAction === 'sign-in'
                        ? 'Connexion...'
                        : mode === 'sign-up'
                          ? hasActiveCompanyInvitation()
                            ? 'Créer mon compte entreprise'
                            : 'Créer mon compte'
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
