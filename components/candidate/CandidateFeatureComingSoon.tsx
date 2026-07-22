'use client';

import Link from 'next/link';
import { CandidateShell } from '@/components/candidate/CandidateShell';
import { SevenoPanel } from '@/components/seveno/SevenoLayout';

type CandidateFeatureComingSoonProps = {
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
};

export function CandidateFeatureComingSoon({
  title,
  description,
  backHref = '/candidat',
  backLabel = 'Retour au tableau de bord',
}: CandidateFeatureComingSoonProps) {
  return (
    <CandidateShell title={title} description={description}>
      <SevenoPanel tone="violet" className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Bientôt disponible</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          Cette fonctionnalité sera ouverte lors du lancement complet de Seven’O.
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>

        <div className="mt-5">
          <Link
            href={backHref}
            className="inline-flex items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
          >
            {backLabel}
          </Link>
        </div>
      </SevenoPanel>
    </CandidateShell>
  );
}
