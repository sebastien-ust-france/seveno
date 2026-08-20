import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PublicSiteShell } from '@/components/public/PublicSiteShell';
import { formatDesiredContractTypeLabels } from '@/lib/seveno-desired-contract-types';
import { getPublicCandidateBySlugServer } from '@/lib/seveno-public-candidates-server';
import { buildCandidateProfileJsonLd, serializeJsonLd } from '@/lib/seveno-public-discovery';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ slug: string }> };

const AVAILABILITY_LABELS = {
  immediate: 'Immédiatement',
  less_than_1_month: 'Moins d’un mois',
  one_to_three_months: 'Sous 1 à 3 mois',
  listening: 'En écoute',
  not_available: 'Non disponible actuellement',
} as const;

const EXPERIENCE_LABELS = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  confirmed: 'Confirmé',
  senior: 'Senior',
  expert: 'Expert',
} as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const candidate = await getPublicCandidateBySlugServer(slug);
  if (!candidate) return { title: 'Profil indisponible | Seven’O', robots: { index: false, follow: false } };
  const role = candidate.targetJobs[0]?.label ?? 'Talent';
  const title = `Candidat anonyme — ${role} — ${candidate.broadLocation} | Seven’O`;
  const description = `Profil professionnel anonyme recherchant un poste de ${role} dans la zone ${candidate.broadLocation}.`;
  return {
    title,
    description,
    alternates: { canonical: `/talents/${candidate.slug}` },
    openGraph: { title, description, url: `/talents/${candidate.slug}`, type: 'profile' },
  };
}

export default async function PublicTalentDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const candidate = await getPublicCandidateBySlugServer(slug);
  if (!candidate) notFound();
  const jsonLd = buildCandidateProfileJsonLd(candidate);

  return (
    <PublicSiteShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <article className="mx-auto max-w-5xl">
        <Link href="/talents" className="text-sm font-semibold text-cyan-200 hover:text-white">← Tous les talents</Link>
        <header className="mt-6 rounded-[32px] border border-blue-300/15 bg-[linear-gradient(180deg,rgba(8,20,38,0.98),rgba(5,12,25,0.95))] p-7 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-200">Profil professionnel anonyme</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{candidate.targetJobs[0]?.label}</h1>
          <p className="mt-4 text-lg text-slate-300">{candidate.broadLocation}</p>
          {candidate.targetJobs.length > 1 ? <p className="mt-3 text-sm text-slate-400">Autres métiers recherchés : {candidate.targetJobs.slice(1).map((job) => job.label).join(', ')}</p> : null}
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5"><p className="text-sm text-slate-400">Contrats recherchés</p><p className="mt-2 font-semibold text-white">{formatDesiredContractTypeLabels(candidate.desiredContractTypeCodes)}</p></div>
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5"><p className="text-sm text-slate-400">Disponibilité</p><p className="mt-2 font-semibold text-white">{AVAILABILITY_LABELS[candidate.availability]}</p></div>
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5"><p className="text-sm text-slate-400">Niveau d’expérience</p><p className="mt-2 font-semibold text-white">{EXPERIENCE_LABELS[candidate.experienceLevel]}</p></div>
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5"><p className="text-sm text-slate-400">Recommandations visibles</p><p className="mt-2 font-semibold text-white">{candidate.recommendationVisibleCount}</p></div>
        </section>

        <section className="mt-6 rounded-[28px] border border-cyan-300/15 bg-cyan-400/5 p-7">
          <h2 className="text-2xl font-semibold text-white">Entrer en relation sur Seven’O</h2>
          <p className="mt-3 max-w-3xl leading-7 text-slate-300">Connectez-vous ou créez un compte entreprise pour découvrir le profil Seven’O dans le cadre sécurisé prévu pour les recruteurs.</p>
          <Link href="/connexion" className="mt-5 inline-flex rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-white">Se connecter ou créer un compte</Link>
        </section>

        <p className="mt-6 text-sm leading-7 text-slate-500">Cette page Web classique ne constitue pas une offre d’emploi et ne bénéficie d’aucune promesse de résultat enrichi dans les moteurs de recherche.</p>
      </article>
    </PublicSiteShell>
  );
}
