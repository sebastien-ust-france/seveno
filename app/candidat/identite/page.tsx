'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentAuthUser } from '@/lib/auth';
import {
  CANDIDATE_IDENTITY_LIMITS,
  splitGoogleDisplayName,
  validateCandidateIdentity,
  type CandidateIdentityFieldErrors,
  type CandidateIdentityFormValues,
} from '@/lib/seveno-candidate-identity';
import {
  ensureSevenoUser,
  resolveSevenoRedirect,
  updateCandidatePrivateIdentity,
} from '@/lib/seveno-users';
import { CandidatePrivacyNotice } from '@/components/candidate/CandidatePrivacyNotice';
import { CandidateShell } from '@/components/candidate/CandidateShell';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import type { SevenoUser } from '@/types/seveno';

const EMPTY_FORM: CandidateIdentityFormValues = {
  firstName: '',
  lastName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: 'France',
};

function buildInitialForm(user: SevenoUser): CandidateIdentityFormValues {
  const hasExistingIdentity = Boolean(
    user.firstName?.trim()
    || user.lastName?.trim()
    || user.phone?.trim()
    || user.addressLine1?.trim()
    || user.addressLine2?.trim()
    || user.postalCode?.trim()
    || user.city?.trim(),
  );
  const googleName = !hasExistingIdentity && user.authProvider === 'google'
    ? splitGoogleDisplayName(user.displayName)
    : { firstName: '', lastName: '' };

  return {
    firstName: user.firstName ?? googleName.firstName,
    lastName: user.lastName ?? googleName.lastName,
    phone: user.phone ?? '',
    addressLine1: user.addressLine1 ?? '',
    addressLine2: user.addressLine2 ?? '',
    postalCode: user.postalCode ?? '',
    city: user.city ?? '',
    country: user.country ?? 'France',
  };
}

function getInitials(user: SevenoUser | null, form: CandidateIdentityFormValues) {
  const initials = `${form.firstName.charAt(0)}${form.lastName.charAt(0)}`.trim();
  if (initials) return initials.toUpperCase();
  if (user?.displayName?.trim()) return user.displayName.trim().charAt(0).toUpperCase();
  return 'S';
}

export default function CandidateIdentityPage() {
  const router = useRouter();
  const submissionLockRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<SevenoUser | null>(null);
  const [form, setForm] = useState<CandidateIdentityFormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<CandidateIdentityFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadIdentity() {
      try {
        const authUser = await getCurrentAuthUser();
        if (!active) return;
        if (!authUser) {
          router.replace('/connexion');
          return;
        }

        const sevenoUser = await ensureSevenoUser(authUser);
        if (!active) return;
        if (sevenoUser.role !== 'candidate') {
          router.replace(resolveSevenoRedirect(sevenoUser));
          return;
        }

        setUser(sevenoUser);
        setForm(buildInitialForm(sevenoUser));
        setLoading(false);
      } catch {
        if (!active) return;
        setError('Votre identité privée n’a pas pu être chargée. Réessayez dans quelques instants.');
        setLoading(false);
      }
    }

    void loadIdentity();
    return () => {
      active = false;
    };
  }, [router]);

  function updateField(field: keyof CandidateIdentityFormValues, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || saving || submissionLockRef.current) return;

    const validation = validateCandidateIdentity(form);
    setFieldErrors(validation.errors);
    if (!validation.data) return;

    submissionLockRef.current = true;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateCandidatePrivateIdentity(user.uid, validation.data);
      setUser(updated);
      setForm(buildInitialForm(updated));
      setSuccess('Votre identité privée a été enregistrée.');
    } catch {
      setError('Votre identité privée n’a pas pu être enregistrée. Vérifiez les champs puis réessayez.');
    } finally {
      submissionLockRef.current = false;
      setSaving(false);
    }
  }

  return (
    <CandidateShell
      title="Identité privée"
      description="Complétez les coordonnées réservées à votre compte. Elles restent séparées de votre profil métier anonyme."
    >
      {loading ? (
        <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
          Chargement de votre identité privée...
        </SevenoPanel>
      ) : user ? (
        <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)} noValidate>
          <Breadcrumbs
            items={[
              { label: 'Candidat', href: '/candidat' },
              { label: 'Mon profil', href: '/candidat/onboarding' },
              { label: 'Identité privée' },
            ]}
          />

          <SevenoPanel tone="cyan" className="p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                {user.photoURL ? (
                  // Firebase Auth photo URLs are user-specific and cannot use a fixed Next.js image host allowlist.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photoURL}
                    alt="Photo du compte"
                    referrerPolicy="no-referrer"
                    className="h-16 w-16 rounded-full border border-cyan-300/20 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 text-xl font-semibold text-cyan-100">
                    {getInitials(user, form)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-white">
                    {[form.firstName, form.lastName].filter(Boolean).join(' ') || 'Identité à compléter'}
                  </p>
                  <p className="mt-1 break-all text-sm text-slate-300">{user.email}</p>
                </div>
              </div>
              <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${user.emailVerified ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100' : 'border-amber-300/20 bg-amber-400/10 text-amber-100'}`}>
                {user.emailVerified ? 'Email vérifié' : 'Email non vérifié'}
              </span>
            </div>
          </SevenoPanel>

          <CandidatePrivacyNotice message="Ces informations restent privées et ne sont jamais affichées dans votre profil candidat anonyme." />

          {success ? <SevenoPanel tone="cyan" className="p-4 text-sm text-cyan-100">{success}</SevenoPanel> : null}
          {error ? <SevenoPanel tone="orange" className="p-4 text-sm text-amber-100">{error}</SevenoPanel> : null}

          <SevenoPanel tone="neutral" className="p-5">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Prénom *</span>
                <input
                  value={form.firstName}
                  onChange={(event) => updateField('firstName', event.target.value)}
                  autoComplete="given-name"
                  maxLength={CANDIDATE_IDENTITY_LIMITS.firstName}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                />
                {fieldErrors.firstName ? <p className="text-xs text-rose-300">{fieldErrors.firstName}</p> : null}
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Nom *</span>
                <input
                  value={form.lastName}
                  onChange={(event) => updateField('lastName', event.target.value)}
                  autoComplete="family-name"
                  maxLength={CANDIDATE_IDENTITY_LIMITS.lastName}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                />
                {fieldErrors.lastName ? <p className="text-xs text-rose-300">{fieldErrors.lastName}</p> : null}
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-200">Adresse email</span>
                <input
                  value={user.email}
                  type="email"
                  autoComplete="email"
                  readOnly
                  aria-readonly="true"
                  className="w-full cursor-not-allowed rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-400 outline-none"
                />
                <p className="text-xs text-slate-500">L’adresse email est gérée exclusivement par Firebase Authentication.</p>
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-200">Téléphone *</span>
                <input
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  type="tel"
                  autoComplete="tel"
                  placeholder="06 12 34 56 78"
                  maxLength={32}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                />
                {fieldErrors.phone ? <p className="text-xs text-rose-300">{fieldErrors.phone}</p> : null}
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-200">Adresse</span>
                <input
                  value={form.addressLine1}
                  onChange={(event) => updateField('addressLine1', event.target.value)}
                  autoComplete="address-line1"
                  maxLength={CANDIDATE_IDENTITY_LIMITS.addressLine1}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                />
                {fieldErrors.addressLine1 ? <p className="text-xs text-rose-300">{fieldErrors.addressLine1}</p> : null}
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-200">Complément d’adresse</span>
                <input
                  value={form.addressLine2}
                  onChange={(event) => updateField('addressLine2', event.target.value)}
                  autoComplete="address-line2"
                  maxLength={CANDIDATE_IDENTITY_LIMITS.addressLine2}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                />
                {fieldErrors.addressLine2 ? <p className="text-xs text-rose-300">{fieldErrors.addressLine2}</p> : null}
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Code postal</span>
                <input
                  value={form.postalCode}
                  onChange={(event) => updateField('postalCode', event.target.value)}
                  autoComplete="postal-code"
                  maxLength={CANDIDATE_IDENTITY_LIMITS.postalCode}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                />
                {fieldErrors.postalCode ? <p className="text-xs text-rose-300">{fieldErrors.postalCode}</p> : null}
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Ville</span>
                <input
                  value={form.city}
                  onChange={(event) => updateField('city', event.target.value)}
                  autoComplete="address-level2"
                  maxLength={CANDIDATE_IDENTITY_LIMITS.city}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                />
                {fieldErrors.city ? <p className="text-xs text-rose-300">{fieldErrors.city}</p> : null}
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-200">Pays</span>
                <input
                  value={form.country}
                  onChange={(event) => updateField('country', event.target.value)}
                  autoComplete="country-name"
                  maxLength={CANDIDATE_IDENTITY_LIMITS.country}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                />
                {fieldErrors.country ? <p className="text-xs text-rose-300">{fieldErrors.country}</p> : null}
              </label>
            </div>
          </SevenoPanel>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-500 px-6 py-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer mon identité'}
            </button>
          </div>
        </form>
      ) : null}
    </CandidateShell>
  );
}
