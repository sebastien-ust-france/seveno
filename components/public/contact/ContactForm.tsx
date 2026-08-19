'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  buildContactMailtoHref,
  CONTACT_GENERAL_VALIDATION_MESSAGE,
  CONTACT_MIN_RENDER_DELAY_MS,
  CONTACT_REASON_OPTIONS,
  normalizeContactSubmission,
  parseContactDraft,
  resolveContactReasonCode,
  validateContactDraft,
  type ContactDraft,
  type ContactFieldErrors,
  type ContactFieldName,
  type ContactReasonCode,
} from '@/lib/seveno-contact';

type ContactFormProps = {
  initialReason?: ContactReasonCode | '';
};

type ContactSubmissionResult =
  | { kind: 'idle' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string; mailtoHref?: string };

type ContactFormState = ContactDraft;

const FIELD_ORDER: Exclude<ContactFieldName, 'general'>[] = ['name', 'email', 'organization', 'reason', 'subject', 'message'];

function buildInitialState(initialReason: ContactReasonCode | ''): ContactFormState {
  return {
    name: '',
    email: '',
    organization: '',
    reason: initialReason,
    subject: '',
    message: '',
    website: '',
    renderedAtMs: Date.now(),
  };
}

function createEmptyTouchedState() {
  return {
    name: false,
    email: false,
    organization: false,
    reason: false,
    subject: false,
    message: false,
  };
}

function inputClasses(hasError: boolean) {
  return [
    'mt-2 w-full rounded-[18px] border bg-white/5 px-4 py-3 text-sm text-white shadow-[0_18px_50px_rgba(2,6,23,0.16)] outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15',
    hasError ? 'border-rose-400/60' : 'border-white/10',
  ].join(' ');
}

function labelClasses() {
  return 'text-sm font-medium text-slate-100';
}

function helperClasses() {
  return 'mt-2 text-xs leading-6 text-slate-400';
}

function fieldErrorId(field: Exclude<ContactFieldName, 'general'>) {
  return `contact-${field}-error`;
}

function fieldHelpId(field: Exclude<ContactFieldName, 'general'>) {
  return `contact-${field}-help`;
}

function buildPayload(form: ContactFormState) {
  return {
    name: form.name,
    email: form.email,
    organization: form.organization,
    reason: form.reason,
    subject: form.subject,
    message: form.message,
    website: form.website,
    renderedAtMs: form.renderedAtMs,
  };
}

function validateWithTiming(draft: ContactDraft) {
  const errors = validateContactDraft(draft);
  const elapsed = draft.renderedAtMs == null ? Number.NaN : Date.now() - draft.renderedAtMs;

  if (!Number.isFinite(elapsed) || elapsed < CONTACT_MIN_RENDER_DELAY_MS) {
    errors.general = 'Veuillez patienter quelques secondes avant d’envoyer votre demande.';
  }

  return errors;
}

function getFirstErrorField(errors: ContactFieldErrors) {
  return FIELD_ORDER.find((field) => Boolean(errors[field])) ?? null;
}

export function ContactForm({ initialReason = '' }: ContactFormProps) {
  const [form, setForm] = useState<ContactFormState>(() => buildInitialState(initialReason));
  const [touched, setTouched] = useState(createEmptyTouchedState);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isReadyToSend, setIsReadyToSend] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ContactSubmissionResult>({ kind: 'idle' });
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
  const nameRef = useRef<HTMLInputElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const organizationRef = useRef<HTMLInputElement | null>(null);
  const reasonRef = useRef<HTMLSelectElement | null>(null);
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsReadyToSend(true), CONTACT_MIN_RENDER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const validationErrors = useMemo(() => validateWithTiming(form), [form]);
  const formIsValid = Object.keys(validationErrors).length === 0;
  const canSubmit = isReadyToSend && formIsValid && !isSubmitting;
  const visibleGeneralError =
    attemptedSubmit && validationErrors.general ? validationErrors.general : result.kind === 'error' ? result.message : '';
  const organizationIsRequired = resolveContactReasonCode(form.reason) === 'acces-entreprise';

  function updateField<K extends keyof ContactFormState>(field: K, value: ContactFormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setResult({ kind: 'idle' });
    setFieldErrors((current) => {
      if (!current[field as keyof ContactFieldErrors]) {
        return current;
      }

      const next = { ...current };
      delete next[field as keyof ContactFieldErrors];
      return next;
    });
  }

  function markTouched(field: Exclude<ContactFieldName, 'general'>) {
    setTouched((current) => ({
      ...current,
      [field]: true,
    }));
  }

  function focusFirstError(errors: ContactFieldErrors) {
    const firstField = getFirstErrorField(errors);
    if (!firstField) {
      return;
    }

    const targets: Record<Exclude<ContactFieldName, 'general'>, HTMLElement | null> = {
      name: nameRef.current,
      email: emailRef.current,
      organization: organizationRef.current,
      reason: reasonRef.current,
      subject: subjectRef.current,
      message: messageRef.current,
    };

    targets[firstField]?.focus();
  }

  function resetForm() {
    setForm(buildInitialState(initialReason));
    setTouched(createEmptyTouchedState());
    setAttemptedSubmit(false);
    setFieldErrors({});
    setResult({ kind: 'idle' });
  }

  function renderFieldError(field: Exclude<ContactFieldName, 'general'>) {
    const error = fieldErrors[field] ?? (attemptedSubmit ? validationErrors[field] : '');
    if (!error) {
      return null;
    }

    return (
      <p id={fieldErrorId(field)} className="mt-2 text-sm text-rose-200">
        {error}
      </p>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttemptedSubmit(true);

    if (!isReadyToSend) {
      setResult({
        kind: 'error',
        message: 'Veuillez patienter quelques secondes avant d’envoyer votre demande.',
      });
      return;
    }

    const parsedDraft = parseContactDraft(buildPayload(form));
    const nextErrors = validateWithTiming(parsedDraft);
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setResult({
        kind: 'error',
        message: CONTACT_GENERAL_VALIDATION_MESSAGE,
      });
      focusFirstError(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setFieldErrors({});
      setResult({ kind: 'idle' });

      const submission = normalizeContactSubmission(buildPayload(form));
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submission),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            success?: boolean;
            message?: string;
            requestId?: string;
            acknowledgementSent?: boolean;
            fieldErrors?: ContactFieldErrors;
            mailtoHref?: string;
          }
        | null;

      if (response.ok && (payload?.success ?? payload?.ok) === true) {
        const successMessage =
          payload?.message ||
          'Votre demande a bien été envoyée. Un message de confirmation a été transmis à l’adresse indiquée lorsque le service d’envoi le permet. Seven’O dispose désormais des informations nécessaires pour examiner votre demande.';
        resetForm();
        setResult({
          kind: 'success',
          message: successMessage,
        });
        return;
      }

      if (payload?.fieldErrors) {
        setFieldErrors(payload.fieldErrors);
        focusFirstError(payload.fieldErrors);
      }

      setResult({
        kind: 'error',
        message: payload?.message || 'Votre demande n’a pas pu être envoyée. Vous pouvez écrire directement à sebastien@seveno.eu.',
        mailtoHref: payload?.mailtoHref || buildContactMailtoHref(submission),
      });
    } catch {
      setResult({
        kind: 'error',
        message: 'Votre demande n’a pas pu être envoyée. Vous pouvez écrire directement à sebastien@seveno.eu.',
        mailtoHref: undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.96),rgba(8,15,28,0.91))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.24)] sm:p-8 lg:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">FORMULAIRE DE CONTACT</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-[2rem]">
        Décrivez votre demande avec précision.
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
        Les informations fournies permettent d’identifier votre demande et de la transmettre au bon interlocuteur.
      </p>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
        <input type="hidden" name="website" value={form.website} readOnly aria-hidden="true" tabIndex={-1} />
        <input type="hidden" name="renderedAtMs" value={String(form.renderedAtMs ?? '')} readOnly />

        <div
          aria-live="polite"
          className={[
            'rounded-[24px] border px-5 py-4 text-sm leading-7',
            result.kind === 'success'
              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
              : result.kind === 'error'
                ? 'border-rose-400/20 bg-rose-400/10 text-rose-100'
                : 'border-white/10 bg-white/5 text-slate-300',
          ].join(' ')}
        >
          {result.kind === 'success' ? (
            <div className="space-y-3">
              <p className="text-lg font-semibold text-white">Votre demande a bien été envoyée.</p>
              <p>
                Un message de confirmation a été transmis à l’adresse indiquée lorsque le service d’envoi le permet.
                Seven’O dispose désormais des informations nécessaires pour examiner votre demande.
              </p>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020817]"
              >
                Envoyer une autre demande
              </button>
            </div>
          ) : result.kind === 'error' ? (
            <div className="space-y-3">
              <p>{visibleGeneralError || CONTACT_GENERAL_VALIDATION_MESSAGE}</p>
              {result.mailtoHref ? (
                <p>
                  <a
                    href={result.mailtoHref}
                    className="font-medium text-cyan-100 underline decoration-cyan-100/40 underline-offset-4"
                  >
                    sebastien@seveno.eu
                  </a>
                </p>
              ) : null}
            </div>
          ) : (
            <p>
              Les champs marqués d’un astérisque sont obligatoires. Les informations transmises sont utilisées
              uniquement pour traiter votre demande et assurer son suivi.
            </p>
          )}
        </div>

        {attemptedSubmit && Object.keys(fieldErrors).length > 0 ? (
          <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100" role="alert">
            <p className="font-semibold">Certains champs doivent être corrigés avant l’envoi.</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              {FIELD_ORDER.map((field) => (fieldErrors[field] ? <li key={field}>{fieldErrors[field]}</li> : null))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="contact-name" className={labelClasses()}>
              Nom et prénom *
            </label>
            <input
              ref={nameRef}
              id="contact-name"
              name="name"
              type="text"
              autoComplete="name"
              minLength={2}
              maxLength={100}
              required
              value={form.name}
              onBlur={() => markTouched('name')}
              onChange={(event) => updateField('name', event.target.value)}
              className={inputClasses(Boolean((attemptedSubmit || touched.name) && (fieldErrors.name ?? validationErrors.name)))}
              aria-invalid={Boolean((attemptedSubmit || touched.name) && (fieldErrors.name ?? validationErrors.name))}
              aria-describedby={fieldErrorId('name')}
              placeholder="Nom et prénom"
            />
            {renderFieldError('name')}
          </div>

          <div>
            <label htmlFor="contact-email" className={labelClasses()}>
              Adresse email *
            </label>
            <input
              ref={emailRef}
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              minLength={3}
              maxLength={254}
              required
              value={form.email}
              onBlur={() => markTouched('email')}
              onChange={(event) => updateField('email', event.target.value)}
              className={inputClasses(Boolean((attemptedSubmit || touched.email) && (fieldErrors.email ?? validationErrors.email)))}
              aria-invalid={Boolean((attemptedSubmit || touched.email) && (fieldErrors.email ?? validationErrors.email))}
              aria-describedby={fieldErrorId('email')}
              placeholder="prenom.nom@organisation.fr"
            />
            {renderFieldError('email')}
          </div>

          <div>
            <label htmlFor="contact-organization" className={labelClasses()}>
              Entreprise ou organisation{organizationIsRequired ? ' *' : ''}
            </label>
            <input
              ref={organizationRef}
              id="contact-organization"
              name="organization"
              type="text"
              autoComplete="organization"
              maxLength={150}
              required={organizationIsRequired}
              value={form.organization}
              onBlur={() => markTouched('organization')}
              onChange={(event) => updateField('organization', event.target.value)}
              className={inputClasses(Boolean((attemptedSubmit || touched.organization) && (fieldErrors.organization ?? validationErrors.organization)))}
              aria-invalid={Boolean((attemptedSubmit || touched.organization) && (fieldErrors.organization ?? validationErrors.organization))}
              aria-describedby={[fieldErrorId('organization'), fieldHelpId('organization')].join(' ')}
              placeholder="Nom de votre structure"
            />
            <p id={fieldHelpId('organization')} className={helperClasses()}>
              Facultatif par défaut. Obligatoire pour une demande d’accès entreprise.
            </p>
            {renderFieldError('organization')}
          </div>

          <div>
            <label htmlFor="contact-reason" className={labelClasses()}>
              Motif de la demande *
            </label>
            <select
              ref={reasonRef}
              id="contact-reason"
              name="reason"
              required
              value={form.reason}
              onBlur={() => markTouched('reason')}
              onChange={(event) => updateField('reason', event.target.value)}
              className={inputClasses(Boolean((attemptedSubmit || touched.reason) && (fieldErrors.reason ?? validationErrors.reason)))}
              aria-invalid={Boolean((attemptedSubmit || touched.reason) && (fieldErrors.reason ?? validationErrors.reason))}
              aria-describedby={fieldErrorId('reason')}
            >
              <option value="">Sélectionnez un motif</option>
              {CONTACT_REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {renderFieldError('reason')}
          </div>
        </div>

        <div>
          <label htmlFor="contact-subject" className={labelClasses()}>
            Objet *
          </label>
          <input
            ref={subjectRef}
            id="contact-subject"
            name="subject"
            type="text"
            minLength={5}
            maxLength={160}
            required
            value={form.subject}
            onBlur={() => markTouched('subject')}
            onChange={(event) => updateField('subject', event.target.value)}
            className={inputClasses(Boolean((attemptedSubmit || touched.subject) && (fieldErrors.subject ?? validationErrors.subject)))}
            aria-invalid={Boolean((attemptedSubmit || touched.subject) && (fieldErrors.subject ?? validationErrors.subject))}
            aria-describedby={fieldErrorId('subject')}
            placeholder="Objet de votre message"
          />
          {renderFieldError('subject')}
        </div>

        <div>
          <label htmlFor="contact-message" className={labelClasses()}>
            Message *
          </label>
          <textarea
            ref={messageRef}
            id="contact-message"
            name="message"
            minLength={20}
            maxLength={3_000}
            required
            value={form.message}
            onBlur={() => markTouched('message')}
            onChange={(event) => updateField('message', event.target.value)}
            placeholder="Décrivez votre question, le contexte rencontré et les informations utiles pour comprendre votre demande."
            className={[
              inputClasses(Boolean((attemptedSubmit || touched.message) && (fieldErrors.message ?? validationErrors.message))),
              'min-h-[220px] resize-y py-4',
            ].join(' ')}
            aria-invalid={Boolean((attemptedSubmit || touched.message) && (fieldErrors.message ?? validationErrors.message))}
            aria-describedby={fieldErrorId('message')}
          />
          {renderFieldError('message')}
        </div>

        <div className="space-y-4">
          <p className="text-sm leading-7 text-slate-300">
            Les champs marqués d’un astérisque sont obligatoires. Les informations transmises sont utilisées uniquement
            pour traiter votre demande et assurer son suivi.
          </p>
          <p className="text-sm leading-7 text-slate-300">
            <Link href="/confidentialite" className="font-medium text-cyan-200 transition hover:text-cyan-100">
              Consulter la Politique de confidentialité
            </Link>
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-7 text-slate-400">
            Les demandes sont traitées dans un cadre confidentiel. Nous revenons vers vous dès que possible avec une
            réponse adaptée.
          </p>
          <button
            type="submit"
            disabled={!canSubmit}
            className={[
              'inline-flex min-h-12 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020817]',
              canSubmit
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-[0_18px_50px_rgba(34,211,238,0.12)] hover:brightness-110'
                : 'cursor-not-allowed bg-white/10 text-slate-400',
            ].join(' ')}
          >
            {isSubmitting ? 'Envoi en cours…' : 'Envoyer ma demande'}
          </button>
        </div>
      </form>
    </section>
  );
}
