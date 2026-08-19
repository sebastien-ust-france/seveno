'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { createEmailPasswordUser, getCurrentAuthUser, refreshAuthUser, sendVerificationEmail, signInWithEmailPassword, signOutUser } from '@/lib/auth';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import type { CompanyMembershipRole } from '@/types/seveno-billing';

type Invitation = { companyName: string; email: string; role: CompanyMembershipRole; roleLabel: string; status: 'pending' | 'expired' | 'accepted' | 'revoked'; expiresAt: string };
type Mode = 'choice' | 'signup' | 'signin' | 'verify' | 'wrong-account' | 'done';

function authMessage(error: unknown) {
  const code = error instanceof FirebaseError ? error.code : '';
  if (code === 'auth/too-many-requests') return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.';
  if (code === 'auth/weak-password') return 'Ce mot de passe ne respecte pas la politique de sécurité Firebase.';
  if (code === 'auth/network-request-failed') return 'Le service d’authentification est momentanément inaccessible.';
  if (code === 'auth/email-already-in-use') return 'Un compte peut déjà utiliser cette adresse. Essayez de vous connecter.';
  if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(code)) return 'Adresse e-mail ou mot de passe incorrect.';
  return error instanceof Error ? error.message : 'L’opération a échoué. Réessayez.';
}

function passwordError(password: string) {
  if (password.length < 12) return 'Le mot de passe doit contenir au moins 12 caractères.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) return 'Ajoutez une minuscule, une majuscule, un chiffre et un caractère spécial.';
  return '';
}

export function MemberInvitationAccess() {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [mode, setMode] = useState<Mode>('choice');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resendAvailableAt, setResendAvailableAt] = useState(0);

  useEffect(() => {
    void Promise.all([fetch('/api/seveno/company-member-invitations/current', { cache: 'no-store' }).then((r) => r.json()), getCurrentAuthUser()])
      .then(([payload, user]: [{ invitation?: Invitation | null; message?: string }, User | null]) => {
        if (!payload.invitation) throw new Error(payload.message || 'Aucune invitation active n’est disponible. Ouvrez de nouveau le lien reçu.');
        setInvitation(payload.invitation);
        setAuthUser(user);
        if (payload.invitation.status !== 'pending') return;
        if (user) setMode(user.email?.trim().toLowerCase() === payload.invitation.email ? (user.emailVerified ? 'choice' : 'verify') : 'wrong-account');
      }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Invitation indisponible.'));
  }, []);

  async function accept(user: User) {
    const result = await fetchSevenoMatchApi<{ companyId: string }>(user, '/api/seveno/company-member-invitations/accept', { method: 'POST' });
    window.localStorage.setItem('seveno_active_company_id', result.companyId);
    setMode('done');
    window.location.assign('/entreprise');
  }

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    if (!invitation || busy) return;
    const issue = passwordError(password);
    if (issue) return setError(issue);
    if (password !== confirmation) return setError('La confirmation du mot de passe ne correspond pas.');
    setBusy(true); setError(''); setNotice('');
    try {
      const user = await createEmailPasswordUser(invitation.email, password);
      setAuthUser(user);
      await sendVerificationEmail(user, `${window.location.origin}/invitation-membre`);
      setResendAvailableAt(Date.now() + 60_000);
      setNotice('Vérifiez votre adresse e-mail. Un message de vérification vient d’être envoyé.');
      setPassword(''); setConfirmation(''); setMode('verify');
    } catch (reason) { setError(authMessage(reason)); } finally { setBusy(false); }
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!invitation || busy) return;
    setBusy(true); setError('');
    try {
      const user = await signInWithEmailPassword(invitation.email, password);
      setAuthUser(user); setPassword('');
      if (!user.emailVerified) { setMode('verify'); setNotice('Vérifiez votre adresse e-mail avant de rejoindre l’entreprise.'); }
      else await accept(user);
    } catch (reason) { setError(authMessage(reason)); } finally { setBusy(false); }
  }

  async function confirmVerification() {
    if (!authUser || busy) return;
    setBusy(true); setError('');
    try {
      const user = await refreshAuthUser(authUser);
      if (!user.emailVerified) throw new Error('L’adresse e-mail n’est pas encore vérifiée. Ouvrez le lien reçu puis réessayez.');
      await accept(user);
    } catch (reason) { setError(authMessage(reason)); } finally { setBusy(false); }
  }

  async function resend() {
    if (!authUser || busy || Date.now() < resendAvailableAt) return;
    setBusy(true); setError('');
    try { await sendVerificationEmail(authUser, `${window.location.origin}/invitation-membre`); setResendAvailableAt(Date.now() + 60_000); setNotice('Un nouvel e-mail de vérification a été envoyé.'); }
    catch (reason) { setError(authMessage(reason)); } finally { setBusy(false); }
  }

  async function handleUseInvitedAccount() {
    setBusy(true); setError('');
    try { await signOutUser(); setAuthUser(null); setMode('signin'); } catch (reason) { setError(authMessage(reason)); } finally { setBusy(false); }
  }

  const statusMessage = invitation?.status === 'expired' ? 'Cette invitation a expiré. Demandez à votre entreprise de vous envoyer une nouvelle invitation.' : invitation?.status === 'revoked' ? 'Cette invitation n’est plus valide.' : invitation?.status === 'accepted' ? 'Cette invitation a déjà été utilisée. Connectez-vous normalement à Seven’O.' : '';

  return <main className="min-h-screen bg-slate-950 px-5 py-12 text-white"><section className="mx-auto max-w-xl rounded-[28px] border border-cyan-400/15 bg-slate-900 p-6 shadow-2xl sm:p-8"><p className="text-xs font-semibold uppercase tracking-[.25em] text-cyan-300">Invitation Seven’O</p><h1 className="mt-3 text-2xl font-semibold">{invitation ? `Vous êtes invité à rejoindre ${invitation.companyName} sur Seven’O.` : 'Ouverture de votre invitation…'}</h1>
    {invitation ? <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm"><p><span className="text-slate-400">Rôle :</span><br />{invitation.roleLabel}</p><p><span className="text-slate-400">Adresse :</span><br />{invitation.email}</p></div> : null}
    {statusMessage ? <p className="mt-5 rounded-2xl bg-amber-400/10 p-4 text-amber-100">{statusMessage}</p> : null}
    {error ? <p role="alert" className="mt-5 rounded-2xl bg-rose-400/10 p-4 text-rose-100">{error}</p> : null}{notice ? <p className="mt-5 rounded-2xl bg-cyan-400/10 p-4 text-cyan-100">{notice}</p> : null}
    {invitation?.status === 'pending' && mode === 'choice' ? <div className="mt-6 grid gap-3"><button className="rounded-full bg-cyan-500 px-5 py-3 font-semibold text-slate-950" onClick={() => authUser ? void accept(authUser) : setMode('signup')}>{authUser ? 'Rejoindre l’entreprise' : 'Créer mon accès Seven’O'}</button>{!authUser ? <button className="rounded-full border border-white/15 px-5 py-3" onClick={() => setMode('signin')}>J’ai déjà un compte</button> : null}</div> : null}
    {invitation?.status === 'pending' && (mode === 'signup' || mode === 'signin') ? <form className="mt-6 space-y-4" onSubmit={mode === 'signup' ? createAccount : signIn}><h2 className="text-xl font-semibold">{mode === 'signup' ? 'Créer mon accès Seven’O' : 'Connectez-vous pour rejoindre l’entreprise.'}</h2><label className="block text-sm text-slate-300">Adresse e-mail<input readOnly value={invitation.email} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-300" /></label><label className="block text-sm text-slate-300">Mot de passe<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3" /></label>{mode === 'signup' ? <label className="block text-sm text-slate-300">Confirmer le mot de passe<input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3" /></label> : null}<button disabled={busy} className="w-full rounded-full bg-cyan-500 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy ? 'Traitement…' : mode === 'signup' ? 'Créer mon compte' : 'Se connecter'}</button><button type="button" className="w-full text-sm text-slate-400" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>{mode === 'signup' ? 'J’ai déjà un compte' : 'Créer mon compte'}</button></form> : null}
    {mode === 'verify' ? <div className="mt-6 space-y-3"><h2 className="text-xl font-semibold">Vérifiez votre adresse e-mail</h2><p className="text-sm leading-6 text-slate-300">Ouvrez le message de Firebase, puis revenez ici. L’acceptation vérifiera de nouveau votre identité côté serveur.</p><button disabled={busy} onClick={() => void confirmVerification()} className="w-full rounded-full bg-cyan-500 px-5 py-3 font-semibold text-slate-950">J’ai vérifié mon adresse</button><button disabled={busy || Date.now() < resendAvailableAt} onClick={() => void resend()} className="w-full rounded-full border border-white/15 px-5 py-3 disabled:opacity-50">Renvoyer l’e-mail</button></div> : null}
    {mode === 'wrong-account' ? <div className="mt-6 space-y-4"><p className="rounded-2xl bg-rose-400/10 p-4 text-rose-100">Cette invitation est destinée à une autre adresse e-mail.</p><button disabled={busy} onClick={() => void handleUseInvitedAccount()} className="w-full rounded-full bg-cyan-500 px-5 py-3 font-semibold text-slate-950">Se connecter avec l’adresse invitée</button></div> : null}
  </section></main>;
}
