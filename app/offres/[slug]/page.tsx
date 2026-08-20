import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PublicSiteShell } from '@/components/public/PublicSiteShell';
import { buildJobPostingJsonLd, serializeJsonLd } from '@/lib/seveno-public-discovery';
import { buildPublicOfferLoginHref } from '@/lib/seveno-public-offer-return';
import { getPublicOfferBySlugServer } from '@/lib/seveno-public-offers-server';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ slug: string }> };

const CONTRACT_LABELS = {
  permanent: 'CDI',
  fixed_term: 'CDD',
  temporary: 'Intérim',
  freelance: 'Freelance',
  apprenticeship: 'Alternance',
  internship: 'Stage',
  other: 'Autre',
} as const;

const WORKING_TIME_LABELS = {
  full_time: 'Temps plein',
  part_time: 'Temps partiel',
  shift: 'Travail posté',
  flexible: 'Horaires flexibles',
  other: 'Autre organisation',
} as const;

const WORK_MODE_LABELS = {
  onsite: 'Sur site',
  hybrid: 'Hybride',
  remote: '100 % à distance',
} as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const offer = await getPublicOfferBySlugServer(slug);
  if (!offer) return { title: 'Offre indisponible | Seven’O', robots: { index: false, follow: false } };
  const publicLocation = offer.location || (offer.workMode ? WORK_MODE_LABELS[offer.workMode] : '') || 'France';
  const description = `${offer.jobRoleLabel} — ${publicLocation}. ${offer.description}`.slice(0, 160);
  return {
    title: `${offer.title} | Seven’O`,
    description,
    alternates: { canonical: `/offres/${offer.slug}` },
    openGraph: { title: `${offer.title} | Seven’O`, description, url: `/offres/${offer.slug}`, type: 'website' },
  };
}

function TextSection({ title, value }: { title: string; value: string }) {
  if (!value) return null;
  return (
    <section className="rounded-[26px] border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mt-4 whitespace-pre-wrap text-[15px] leading-8 text-slate-300">{value}</p>
    </section>
  );
}

function PrerequisiteSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-[26px] border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <ul className="mt-4 space-y-3 text-[15px] leading-7 text-slate-300">
        {items.map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </section>
  );
}

export default async function PublicOfferDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const offer = await getPublicOfferBySlugServer(slug);
  if (!offer) notFound();
  const jsonLd = buildJobPostingJsonLd(offer);

  return (
    <PublicSiteShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <article className="mx-auto max-w-6xl">
        <Link href="/offres" className="text-sm font-semibold text-cyan-200 hover:text-white">← Toutes les offres</Link>
        <header className="mt-6 rounded-[32px] border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(8,20,38,0.98),rgba(5,12,25,0.95))] p-7 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">{offer.jobRoleLabel}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{offer.title}</h1>
          <div className="mt-6 flex flex-wrap gap-2 text-sm text-slate-200">
            {offer.location ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{offer.location}</span> : null}
            {offer.contractType ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{CONTRACT_LABELS[offer.contractType]}</span> : null}
            {offer.workingTime ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{WORKING_TIME_LABELS[offer.workingTime]}</span> : null}
            {offer.workMode ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{WORK_MODE_LABELS[offer.workMode]}</span> : null}
          </div>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <TextSection title="Description" value={offer.description} />
          <TextSection title="Missions" value={offer.missions} />
          <TextSection title="Profil recherché" value={offer.profileSummary} />
          <PrerequisiteSection title="Prérequis obligatoires" items={offer.requiredPrerequisites} />
          <PrerequisiteSection title="Prérequis complémentaires" items={offer.preferredPrerequisites} />
        </div>

        <section className="mt-6 rounded-[28px] border border-blue-300/15 bg-blue-400/5 p-7">
          <h2 className="text-2xl font-semibold text-white">Candidater sans commencer par un CV</h2>
          <p className="mt-3 max-w-3xl leading-7 text-slate-300">
            Connectez-vous à votre espace candidat pour retrouver cette offre et suivre le parcours de candidature Seven’O.
          </p>
          <Link href={buildPublicOfferLoginHref(offer.slug)} className="mt-5 inline-flex rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-white">
            Accéder aux offres et candidater
          </Link>
        </section>
      </article>
    </PublicSiteShell>
  );
}
