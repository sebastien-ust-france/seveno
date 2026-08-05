'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  getJobApplicationContactSharingClient,
  shareJobApplicationContactClient,
} from '@/lib/seveno-job-applications';
import type { JobApplicationContactSharingView } from '@/types/seveno-job-applications';

type JobApplicationContactSharingProps = {
  authUser: User;
  applicationId: string;
  actor: 'candidate' | 'company';
};

type Contact = NonNullable<JobApplicationContactSharingView['candidate']['contact']>
  | NonNullable<JobApplicationContactSharingView['company']['contact']>;

function ContactCard({ contact }: { contact: Contact }) {
  const entries = [
    ['Entreprise', 'companyName' in contact ? contact.companyName : undefined],
    ['Contact', 'contactName' in contact ? contact.contactName : undefined],
    ['Nom', 'displayName' in contact ? contact.displayName : undefined],
    ['E-mail', contact.email],
    ['Téléphone', contact.phone],
  ].filter(([, value]) => Boolean(value));

  return (
    <article className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
      {entries.map(([label, value]) => (
        <p key={label} className="mt-2 first:mt-0">
          <span className="text-cyan-100/70">{label} :</span> {value}
        </p>
      ))}
    </article>
  );
}

export function JobApplicationContactSharing({ authUser, applicationId, actor }: JobApplicationContactSharingProps) {
  const [sharing, setSharing] = useState<JobApplicationContactSharingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const payload = await getJobApplicationContactSharingClient(authUser, applicationId);
        if (active) setSharing(payload);
      } catch {
        if (active) setError('Le partage de vos coordonnées n’a pas pu être enregistré. Veuillez réessayer.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [applicationId, authUser]);

  const mine = actor === 'candidate' ? sharing?.candidate : sharing?.company;
  const other = actor === 'candidate' ? sharing?.company : sharing?.candidate;

  async function share() {
    setSubmitting(true);
    setError(null);
    try {
      setSharing(await shareJobApplicationContactClient(authUser, applicationId));
      setConfirming(false);
    } catch {
      setError('Le partage de vos coordonnées n’a pas pu être enregistré. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5" aria-labelledby="contact-sharing-title">
      <h3 id="contact-sharing-title" className="text-xl font-semibold text-white">Coordonnées</h3>
      {loading ? <p className="mt-3 text-sm text-slate-300">Chargement...</p> : null}
      {!loading && mine?.shared ? <p className="mt-3 text-sm text-cyan-100">Vos coordonnées sont partagées.</p> : null}
      {!loading && !mine?.shared ? (
        <div className="mt-3">
          <p className="text-sm leading-7 text-slate-300">Vous choisissez librement de partager vos coordonnées. Cette action n’affiche pas automatiquement celles de l’autre partie.</p>
          <button
            type="button"
            disabled={submitting}
            onClick={() => setConfirming(true)}
            className="mt-4 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Partager mes coordonnées
          </button>
        </div>
      ) : null}
      {!loading && other?.shared && other.contact ? <ContactCard contact={other.contact} /> : null}
      {!loading && !other?.shared ? <p className="mt-4 text-sm text-slate-300">L’autre partie n’a pas partagé ses coordonnées.</p> : null}
      {error ? <p className="mt-4 text-sm text-orange-100">{error}</p> : null}

      {confirming ? (
        <div role="dialog" aria-modal="true" aria-labelledby="contact-sharing-confirmation" className="mt-5 rounded-2xl border border-cyan-300/20 bg-slate-950/80 p-4">
          <h4 id="contact-sharing-confirmation" className="text-lg font-semibold text-white">Partager vos coordonnées ?</h4>
          <p className="mt-2 text-sm leading-7 text-slate-300">Vos coordonnées disponibles seront visibles par l’autre partie. Son propre partage reste indépendant.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void share()}
              className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Confirmer le partage
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setConfirming(false)}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}