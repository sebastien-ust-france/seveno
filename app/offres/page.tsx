import type { Metadata } from 'next';
import Link from 'next/link';

import { PublicSiteShell } from '@/components/public/PublicSiteShell';
import { listPublicOffersServer } from '@/lib/seveno-public-offers-server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Offres d’emploi publiées | Seven’O',
  description: 'Découvrez les offres d’emploi publiées sur Seven’O, fondées sur les compétences et le potentiel.',
  alternates: { canonical: '/offres' },
};

const WORK_MODE_LABELS = {
  onsite: 'Sur site',
  hybrid: 'Hybride',
  remote: '100 % à distance',
} as const;

export default async function PublicOffersPage() {
  const offers = await listPublicOffersServer();

  return (
    <PublicSiteShell>
      <section className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-[0.26em] text-cyan-200/85">Offres publiques</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Les postes ouverts sur Seven’O</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          Découvrez des opportunités où les compétences et le potentiel passent avant le CV. Seules les offres actuellement publiées apparaissent ici.
        </p>

        {offers.length === 0 ? (
          <div className="mt-10 rounded-[28px] border border-white/10 bg-white/5 p-7 text-slate-300">
            Aucune offre publique n’est disponible pour le moment.
          </div>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {offers.map((offer) => (
              <article key={offer.slug} className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                <p className="text-sm font-medium text-cyan-200">{offer.jobRoleLabel}</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  <Link href={`/offres/${offer.slug}`} className="transition hover:text-cyan-100">
                    {offer.title}
                  </Link>
                </h2>
                <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-300">
                  {offer.location ? <span className="rounded-full border border-white/10 px-3 py-1">{offer.location}</span> : null}
                  {offer.workMode ? <span className="rounded-full border border-white/10 px-3 py-1">{WORK_MODE_LABELS[offer.workMode]}</span> : null}
                </div>
                <p className="mt-5 line-clamp-3 text-sm leading-7 text-slate-300">{offer.description}</p>
                <Link href={`/offres/${offer.slug}`} className="mt-6 inline-flex font-semibold text-cyan-200 hover:text-white">
                  Consulter l’offre
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </PublicSiteShell>
  );
}
