import type { Metadata } from 'next';
import Link from 'next/link';

import { PublicSiteShell } from '@/components/public/PublicSiteShell';
import { listPublicCandidatesServer } from '@/lib/seveno-public-candidates-server';
import { formatDesiredContractTypeLabels } from '@/lib/seveno-desired-contract-types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Talents anonymes disponibles | Seven’O',
  description: 'Découvrez des profils professionnels anonymes ayant choisi une visibilité publique sur Seven’O.',
  alternates: { canonical: '/talents' },
};

export default async function PublicTalentsPage() {
  const candidates = await listPublicCandidatesServer();
  return (
    <PublicSiteShell>
      <section className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-[0.26em] text-blue-200/85">Talents publics et anonymes</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Des compétences à découvrir, sans identité exposée</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          Ces candidats ont activé séparément la visibilité publique de leur profil professionnel anonyme. Leurs coordonnées restent privées.
        </p>
        {candidates.length === 0 ? (
          <div className="mt-10 rounded-[28px] border border-white/10 bg-white/5 p-7 text-slate-300">Aucun profil n’est actuellement visible sur le Web public.</div>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {candidates.map((candidate) => (
              <article key={candidate.slug} className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                <p className="text-sm font-medium text-blue-200">Candidat anonyme</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  <Link href={`/talents/${candidate.slug}`} className="hover:text-cyan-100">{candidate.targetJobs[0]?.label}</Link>
                </h2>
                <p className="mt-3 text-slate-300">{candidate.broadLocation}</p>
                <p className="mt-3 text-sm text-slate-400">Contrats : {formatDesiredContractTypeLabels(candidate.desiredContractTypeCodes)}</p>
                <Link href={`/talents/${candidate.slug}`} className="mt-6 inline-flex font-semibold text-cyan-200 hover:text-white">Voir le profil anonyme</Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </PublicSiteShell>
  );
}
