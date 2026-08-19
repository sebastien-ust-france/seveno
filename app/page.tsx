import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { HomeFaqSection } from '@/components/public/HomeFaqSection';
import { PublicSiteShell } from '@/components/public/PublicSiteShell';
import { getPublicStudyResponseCount } from '@/lib/study-public';

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

export const revalidate = 900;

const professionalJourney = [
  'Présenter son parcours et ses compétences',
  'Indiquer sa disponibilité',
  'Compléter le questionnaire général Seven’O',
  'Ajouter des recommandations vérifiables',
] as const;

const companyJourney = [
  'Décrire le poste et ses missions',
  'Choisir les compétences à évaluer',
  'Distinguer les prérequis des compétences',
  'Préparer l’évaluation métier liée à l’offre',
] as const;

const engineSteps = [
  {
    title: 'Définir le besoin',
    text: 'L’entreprise précise les missions, les compétences et les conditions réellement liées au poste.',
    tone: 'blue',
  },
  {
    title: 'Évaluer ce qui compte',
    text: 'Seven’O apporte une lecture transversale du profil et une évaluation métier construite pour l’offre.',
    tone: 'cyan',
  },
  {
    title: 'Ouvrir un échange pertinent',
    text: 'Les résultats donnent des éléments concrets à approfondir avant que les identités soient dévoilées.',
    tone: 'blue',
  },
] as const;

function formatParticipationMessage(totalResponses: number) {
  if (totalResponses === 1) {
    return '1 personne a déjà contribué à l’étude Seven’O.';
  }

  return `${totalResponses} personnes ont déjà contribué à l’étude Seven’O.`;
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">{eyebrow}</p>
      <h2 className="mt-4 max-w-5xl text-3xl font-semibold tracking-tight text-seveno-text-primary sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>
      <p className="mt-5 max-w-4xl text-base leading-8 text-seveno-text-secondary sm:text-lg">{description}</p>
    </div>
  );
}

function HeroBrandComposition() {
  const usualRecruitmentSteps = ['CV', 'Tri des candidatures', 'Entretien', 'Compétences supposées'];
  const sevenoRecruitmentSteps = ['Questionnaire métier', 'Compétences évaluées', 'Échange', 'CV'];

  return (
    <div className="relative h-full overflow-hidden rounded-[34px] border border-seveno-brand-cyan/20 bg-[linear-gradient(180deg,rgba(11,19,36,0.98),rgba(8,15,28,0.96))] p-5 shadow-[0_30px_100px_rgba(2,6,23,0.42)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgb(var(--seveno-brand-cyan)/0.2),transparent_26%),radial-gradient(circle_at_bottom_left,rgb(var(--seveno-brand-blue)/0.2),transparent_30%)]" />
      <div className="relative flex min-h-[560px] flex-col justify-between gap-6 lg:min-h-full">
        <section className="flex basis-[35%] flex-col justify-center rounded-[24px] border border-white/10 bg-slate-950/55 p-5 shadow-[0_18px_60px_rgba(2,6,23,0.2)]">
          <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">LE RECRUTEMENT HABITUEL</h2>
          <div className="relative mt-5 overflow-hidden py-2">
            <ol className="flex flex-col gap-2 opacity-60 sm:flex-row sm:items-stretch">
              {usualRecruitmentSteps.map((step, index) => (
                <li key={step} className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:flex-row">
                  <span className="flex min-h-11 w-full min-w-0 flex-1 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-2 py-2 text-center text-xs font-semibold leading-5 text-slate-300">
                    {step}
                  </span>
                  {index < usualRecruitmentSteps.length - 1 ? <span aria-hidden="true" className="rotate-90 text-sm text-slate-500 sm:rotate-0">→</span> : null}
                </li>
              ))}
            </ol>
            <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[5px] w-[165%] -translate-x-1/2 -translate-y-1/2 rotate-[-55deg] rounded-full bg-rose-500/90 shadow-[0_0_18px_rgba(244,63,94,0.35)] sm:w-[112%] sm:rotate-[-9deg]" />
            <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[5px] w-[165%] -translate-x-1/2 -translate-y-1/2 rotate-[55deg] rounded-full bg-rose-500/90 shadow-[0_0_18px_rgba(244,63,94,0.35)] sm:w-[112%] sm:rotate-[9deg]" />
          </div>
        </section>

        <div className="flex basis-[20%] items-center gap-4 py-2 text-center">
          <span aria-hidden="true" className="hidden h-px flex-1 bg-white/10 sm:block" />
          <p className="text-xl font-semibold leading-8 text-seveno-text-primary sm:text-2xl">
            Remettre le <span className="text-seveno-brand-blue">recrutement</span> dans le <span className="text-seveno-brand-cyan">bon ordre</span>.
          </p>
          <span aria-hidden="true" className="hidden h-px flex-1 bg-white/10 sm:block" />
        </div>

        <section className="flex basis-[45%] flex-col justify-center rounded-[26px] border border-seveno-brand-cyan/30 bg-[radial-gradient(circle_at_top_left,rgb(var(--seveno-brand-cyan)/0.14),transparent_45%),linear-gradient(135deg,rgb(var(--seveno-brand-blue)/0.12),rgb(var(--seveno-brand-cyan)/0.06))] p-5 shadow-[0_24px_70px_rgba(2,132,199,0.16)]">
          <div className="flex items-center gap-3">
            <Image src="/images/icone-tdb-seveno-transparent.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.26em] text-seveno-brand-cyan">AVEC SEVEN’O</h2>
          </div>
          <ol className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-stretch">
            {sevenoRecruitmentSteps.map((step, index) => (
              <li key={step} className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:flex-row">
                <div className={[
                  'flex min-h-16 w-full min-w-0 flex-1 flex-col items-center justify-center rounded-[14px] border px-2 py-3 text-center text-xs font-semibold leading-5',
                  index === 0 ? 'border-seveno-brand-cyan/35 bg-seveno-brand-cyan/12 text-cyan-100' : '',
                  index === 1 ? 'border-seveno-brand-cyan/35 bg-gradient-to-br from-seveno-brand-cyan/15 to-seveno-brand-blue/15 text-cyan-50' : '',
                  index === 2 ? 'border-seveno-brand-blue/40 bg-seveno-brand-blue/15 text-blue-100' : '',
                  index === 3 ? 'border-seveno-brand-blue/30 bg-white/[0.06] text-white' : '',
                ].join(' ')}>
                  <span>{step}</span>
                  {index === 3 ? <span className="mt-1 text-[0.65rem] font-normal leading-4 text-seveno-text-muted">Le parcours complète l’évaluation.</span> : null}
                </div>
                {index < sevenoRecruitmentSteps.length - 1 ? <span aria-hidden="true" className="rotate-90 text-sm text-seveno-brand-blue sm:rotate-0">→</span> : null}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm leading-6 text-seveno-text-secondary">
            Les compétences et l’intérêt professionnel sont examinés avant que le parcours ne complète la lecture.
          </p>
        </section>
      </div>
    </div>
  );
}

function JourneyList({ items, tone }: { items: readonly string[]; tone: 'cyan' | 'blue' }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((item, index) => (
        <li key={item} className="flex items-start gap-3 text-sm leading-7 text-seveno-text-secondary sm:text-base">
          <span
            className={[
              'mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
              tone === 'cyan'
                ? 'border-seveno-brand-cyan/35 bg-seveno-brand-cyan/10 text-seveno-candidate'
                : 'border-seveno-brand-blue/35 bg-seveno-brand-blue/10 text-seveno-company',
            ].join(' ')}
          >
            {index + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function HomePage() {
  const publicStudyCount = await getPublicStudyResponseCount();
  const studyParticipationMessage = formatParticipationMessage(publicStudyCount.totalResponses);

  return (
    <PublicSiteShell>
      <div className="space-y-14 lg:space-y-20">
        <section className="rounded-[26px] border border-seveno-brand-cyan/20 bg-white/[0.04] px-5 py-4 shadow-[0_18px_60px_rgba(2,6,23,0.16)] sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-seveno-brand-cyan">ÉTUDE SEVEN&apos;O EN COURS</p>
              <p className="mt-2 text-sm leading-7 text-seveno-text-secondary">{studyParticipationMessage}</p>
            </div>
            <Link
              href="/etude"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-seveno-brand-cyan/30 bg-seveno-brand-cyan/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-seveno-brand-cyan/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus"
            >
              Participer à l’étude Seven&apos;O
            </Link>
          </div>
        </section>

        <section className="overflow-hidden rounded-[36px] border border-seveno-brand-cyan/20 bg-[linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.94))] shadow-[0_28px_100px_rgba(2,6,23,0.4)]">
          <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-6 p-6 sm:p-8 lg:p-10 xl:p-12">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-seveno-brand-cyan">RECRUTEMENT ET OBSERVATOIRE DES TALENTS</p>
              <h1
                aria-label="Le bon recrutement ne commence pas par une pile de CV. Il commence par une rencontre qui a du sens."
                className="max-w-3xl text-4xl font-semibold tracking-tight text-seveno-text-primary sm:text-5xl lg:text-6xl"
              >
                <span aria-hidden="true">Le bon <span className="text-seveno-brand-blue">recrutement</span> ne commence pas par une pile de CV. Il commence par une <span className="text-seveno-brand-blue">rencontre</span> qui a du <span className="text-seveno-brand-cyan">sens</span>.</span>
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-seveno-text-secondary">
                Seven’O prépare une autre façon de faire se rencontrer les professionnels et les entreprises : mieux comprendre les compétences, vérifier que l’opportunité est toujours actuelle et permettre un premier échange avant que les identités ne prennent toute la place.
              </p>
              <p aria-label="Moins de tri. Moins de silence. Plus de rencontres au bon moment." className="max-w-3xl text-xl font-semibold leading-8 text-seveno-text-primary sm:text-2xl">
                <span aria-hidden="true">Moins de tri. Moins de silence. Plus de <span className="text-seveno-brand-blue">rencontres</span> au <span className="text-seveno-brand-cyan">bon moment</span>.</span>
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/comment-ca-marche"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-seveno-action-primary px-6 py-3 text-center text-sm font-semibold text-seveno-text-on-accent transition hover:bg-seveno-action-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-seveno-surface-page"
                >
                  Découvrir comment fonctionne Seven&apos;O
                </Link>
                <Link
                  href="#parcours-seveno-home"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-seveno-text-primary transition hover:border-seveno-brand-blue/45 hover:bg-seveno-brand-blue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus"
                >
                  Choisir mon parcours
                </Link>
              </div>
            </div>
            <div className="relative border-t border-white/10 p-6 lg:border-l lg:border-t-0 lg:p-8 xl:p-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgb(var(--seveno-brand-cyan)/0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgb(var(--seveno-brand-blue)/0.16),transparent_32%)]" />
              <div className="relative h-full"><HeroBrandComposition /></div>
            </div>
          </div>
        </section>

        <section className="border-l-2 border-seveno-brand-blue/45 py-2 pl-6 sm:pl-8 lg:pl-10">
          <SectionHeading
            eyebrow="LE CONSTAT"
            title={<span aria-label="Le recrutement ne manque pas de candidats. Il manque de clarté." className="block lg:text-5xl"><span aria-hidden="true">Le <span className="text-seveno-brand-blue">recrutement</span> ne manque pas de <span className="text-seveno-brand-cyan">candidats</span>. Il manque de <span className="text-seveno-brand-cyan">clarté</span>.</span></span>}
            description="Les candidatures sont encore largement interprétées à travers un parcours, un intitulé, un diplôme ou des mots-clés. Ces éléments restent utiles, mais ils ne suffisent pas toujours à montrer ce qu’une personne sait réellement mobiliser pour un poste."
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <article className="rounded-[26px] border border-seveno-brand-cyan/20 bg-white/[0.04] p-5">
              <h3 className="text-lg font-semibold text-seveno-text-primary">Des candidats écartés trop tôt</h3>
              <p className="mt-3 text-base leading-8 text-seveno-text-secondary">Un parcours atypique, une reconversion ou une expérience formulée autrement peuvent masquer des compétences réellement transférables.</p>
            </article>
            <article className="rounded-[26px] border border-seveno-brand-blue/20 bg-white/[0.04] p-5">
              <h3 className="text-lg font-semibold text-seveno-text-primary">Des entreprises mobilisées trop longtemps</h3>
              <p className="mt-3 text-base leading-8 text-seveno-text-secondary">Le tri, les entretiens et l’intégration peuvent commencer avant qu’une véritable évaluation métier ait permis de vérifier l’adéquation avec le poste.</p>
            </article>
          </div>
          <p className="mt-7 max-w-4xl text-lg font-semibold leading-8 text-seveno-text-primary">Le problème n’est pas seulement de trouver plus de profils. C’est de mieux <span className="text-seveno-brand-cyan">évaluer</span> ceux qui peuvent réellement correspondre.</p>
        </section>

        <section id="moteur-seveno-home" className="relative overflow-hidden rounded-[36px] border border-seveno-brand-blue/30 bg-[radial-gradient(circle_at_top_right,rgb(var(--seveno-brand-blue)/0.18),transparent_34%),linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.94))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.3)] sm:p-8 lg:p-10">
          <SectionHeading
            eyebrow="LE MOTEUR SEVEN’O"
            title={<span aria-label="Un CV laisse supposer des compétences. Seven’O les confronte aux réalités du poste."><span aria-hidden="true">Un CV laisse <span className="text-seveno-brand-cyan">supposer</span> des compétences. <span className="text-seveno-brand-blue">Seven’O</span> les <span className="text-seveno-brand-cyan">confronte</span> aux réalités du <span className="text-seveno-brand-blue">poste</span>.</span></span>}
            description="Seven’O croise deux lectures complémentaires : les aptitudes professionnelles transversales du candidat et les compétences nécessaires à l’offre."
          />
          <ol className="mt-10 grid gap-6 lg:grid-cols-[0.8fr_auto_1.25fr_auto_0.8fr] lg:items-center">
            <li className="border-l-2 border-seveno-brand-blue/45 py-2 pl-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-seveno-brand-blue">BESOIN</p>
              <h3 className="mt-4 text-xl font-semibold text-seveno-text-primary">{engineSteps[0].title}</h3>
              <p className="mt-3 text-sm leading-7 text-seveno-text-secondary">{engineSteps[0].text}</p>
            </li>
            <li aria-hidden="true" className="hidden text-3xl text-seveno-brand-blue lg:block">→</li>
            <li className="relative overflow-hidden rounded-[32px] border border-seveno-brand-cyan/45 bg-[radial-gradient(circle_at_top,rgb(var(--seveno-brand-cyan)/0.2),transparent_58%),linear-gradient(180deg,rgba(13,28,48,0.98),rgba(8,17,31,0.98))] p-7 text-center shadow-[0_26px_80px_rgba(2,132,199,0.18)] sm:p-9">
              <Image src="/images/icone-tdb-seveno-transparent.png" alt="" width={84} height={84} className="mx-auto h-20 w-20 object-contain" />
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.26em] text-seveno-brand-cyan">MOTEUR SEVEN’O</p>
              <h3 className="mt-4 text-2xl font-semibold text-seveno-text-primary">{engineSteps[1].title}</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-seveno-text-secondary">{engineSteps[1].text}</p>
            </li>
            <li aria-hidden="true" className="hidden text-3xl text-seveno-brand-blue lg:block">→</li>
            <li className="border-l-2 border-seveno-brand-cyan/45 py-2 pl-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-seveno-brand-cyan">ÉCHANGE</p>
              <h3 className="mt-4 text-xl font-semibold text-seveno-text-primary">{engineSteps[2].title}</h3>
              <p className="mt-3 text-sm leading-7 text-seveno-text-secondary">{engineSteps[2].text}</p>
            </li>
          </ol>
          <div className="mt-8">
            <Link href="/entreprises#moteur-seveno" className="inline-flex min-h-11 items-center justify-center rounded-full border border-seveno-brand-blue/40 bg-seveno-brand-blue/10 px-6 py-3 text-sm font-semibold text-seveno-text-primary transition hover:border-seveno-brand-blue/65 hover:bg-seveno-brand-blue/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus">
              Découvrir le parcours entreprise
            </Link>
          </div>
        </section>

        <section id="parcours-seveno-home" className="py-2">
          <SectionHeading
            eyebrow="DEUX PARCOURS, UNE RENCONTRE"
            title={<>Chacun <span className="text-seveno-brand-cyan">avance</span> avec ses informations. Seven’O <span className="text-seveno-brand-blue">rapproche</span> les éléments <span className="text-seveno-brand-cyan">utiles</span>.</>}
            description="Les deux parties construisent leur lecture du besoin et du profil avant que l’identité ne prenne toute la place."
          />
          <div className="mt-9 grid gap-4 lg:grid-cols-[1fr_0.72fr_1fr] lg:items-stretch">
            <article className="rounded-[28px] border border-seveno-brand-cyan/30 bg-seveno-brand-cyan/5 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-seveno-candidate">PROFESSIONNEL</p>
              <h3 className="mt-3 text-xl font-semibold text-seveno-text-primary">Pour le professionnel</h3>
              <JourneyList items={professionalJourney} tone="cyan" />
            </article>
            <article className="flex flex-col justify-center rounded-[28px] border border-white/15 bg-[radial-gradient(circle_at_center,rgb(var(--seveno-brand-cyan)/0.12),transparent_62%)] p-6 text-center">
              <Image src="/images/icone-tdb-seveno-transparent.png" alt="" width={72} height={72} className="mx-auto h-16 w-16 object-contain" />
              <h3 className="mt-4 text-xl font-semibold text-seveno-text-primary">La zone de rencontre</h3>
              <p className="mt-3 text-sm leading-7 text-seveno-text-secondary">Seven’O rapproche les deux parcours à partir d’éléments professionnels avant que le CV, la marque ou l’identité ne prennent toute la place.</p>
            </article>
            <article className="rounded-[28px] border border-seveno-brand-blue/30 bg-seveno-brand-blue/5 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-seveno-company">ENTREPRISE</p>
              <h3 className="mt-3 text-xl font-semibold text-seveno-text-primary">Pour l’entreprise</h3>
              <JourneyList items={companyJourney} tone="blue" />
            </article>
          </div>
          <p className="mt-7 text-center text-lg font-semibold leading-8 text-seveno-text-primary">Une rencontre fondée sur des éléments <span className="text-seveno-brand-cyan">concrets</span>, pas uniquement sur la ressemblance entre deux <span className="text-seveno-brand-blue">parcours</span>.</p>
        </section>

        <section className="grid gap-6 border-y border-white/10 py-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div className="rounded-[28px] border border-seveno-brand-cyan/25 bg-seveno-brand-cyan/5 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-seveno-brand-cyan">MISE À JOUR SIMPLE</p>
            <div className="mt-5 flex items-center gap-3" aria-hidden="true">
              <span className="h-3 w-3 rounded-full bg-seveno-brand-cyan" />
              <span className="h-px flex-1 bg-seveno-brand-cyan/30" />
              <span className="h-3 w-3 rounded-full border border-seveno-brand-blue/60" />
            </div>
            <p className="mt-5 text-sm leading-7 text-seveno-text-secondary">Une information utile lorsqu’elle reflète encore la situation du candidat.</p>
          </div>
          <div>
            <SectionHeading
              eyebrow="DISPONIBILITÉ RÉELLE"
              title={<span aria-label="Un profil disponible doit le rester dans les faits, pas seulement dans une base de données."><span aria-hidden="true">Un profil <span className="text-seveno-brand-cyan">disponible</span> doit le rester dans les <span className="text-seveno-brand-blue">faits</span>, pas seulement dans une base de <span className="text-seveno-brand-blue">données</span>.</span></span>}
              description="Le candidat indique s’il est disponible immédiatement, à court terme ou plus tard. Cette information peut être mise à jour rapidement afin que l’entreprise ne travaille pas sur une disponibilité devenue obsolète."
            />
          </div>
        </section>

        <section className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.94))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.28)] sm:p-8 lg:p-10">
          <SectionHeading
            eyebrow="ANONYMAT ET INTÉRÊT MUTUEL"
            title={<span aria-label="Les identités viennent après l’intérêt, pas avant."><span aria-hidden="true">Les <span className="text-seveno-brand-warm">identités</span> viennent après l’<span className="text-seveno-brand-cyan">intérêt</span>, pas avant.</span></span>}
            description="Seven’O utilise l’anonymat pour éviter qu’un nom, une photo, une réputation ou une marque ne décide de la suite avant même que les compétences, le besoin et les conditions aient été compris."
          />
          <div className="mt-8 space-y-6">
            <div className="grid gap-4 xl:grid-cols-2">
              <article className="rounded-[28px] border border-seveno-brand-cyan/35 bg-seveno-brand-cyan/5 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-seveno-candidate">Pour le candidat</h3>
                <p className="mt-4 text-base leading-8 text-seveno-text-secondary">Le candidat est d’abord découvert à travers ce qu’il sait faire, ce qu’il recherche, son expérience, sa disponibilité et ses recommandations. Son nom, ses coordonnées, sa photo et son adresse précise restent privés.</p>
              </article>
              <article className="rounded-[28px] border border-seveno-brand-blue/35 bg-seveno-brand-blue/5 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-seveno-company">Pour l’entreprise</h3>
                <p className="mt-4 text-base leading-8 text-seveno-text-secondary">L’entreprise est d’abord découverte à travers le poste proposé, les missions, les attentes, les conditions et le contexte de travail. Son identité ne prend place qu’une fois l’intérêt pour l’opportunité confirmé.</p>
              </article>
            </div>
            <div className="relative overflow-hidden rounded-[28px] border border-seveno-brand-blue/30 bg-slate-950/35 px-5 py-4 sm:px-6">
              <div className="absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-seveno-brand-cyan via-seveno-brand-blue to-seveno-brand-warm opacity-55" />
              <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-100">MISE EN RELATION PROCHAINEMENT</p>
                <p className="text-sm leading-7 text-seveno-text-secondary">Dans le parcours complet Seven’O, lorsque les deux parties souhaiteront avancer, les identités seront révélées et la conversation pourra commencer.</p>
              </div>
            </div>
            <p className="max-w-4xl text-lg font-semibold leading-8 text-seveno-text-primary sm:text-xl">L’anonymat n’est pas là pour cacher. Il est là pour remettre les éléments professionnels au centre de la première décision.</p>
          </div>
        </section>

        <section className="py-2">
          <SectionHeading
            eyebrow="OUVERTURE PROGRESSIVE"
            title={<>Seven’O <span className="text-seveno-brand-cyan">ouvre</span> <span className="text-seveno-brand-blue">progressivement</span> ses premiers <span className="text-seveno-brand-cyan">parcours</span>.</>}
            description="La plateforme avance avec un nombre limité de premiers utilisateurs afin de tester les usages, recueillir les retours et améliorer chaque parcours avant une ouverture plus large."
          />
          <div className="mt-9 grid gap-4 lg:grid-cols-2">
            <article className="flex flex-col rounded-[26px] border border-seveno-brand-cyan/25 bg-white/[0.04] p-6">
              <h3 className="text-xl font-semibold text-seveno-text-primary">Préparer mon profil</h3>
              <p className="mt-3 flex-1 text-sm leading-7 text-seveno-text-secondary">Les candidats peuvent déjà créer leur compte, préciser leur disponibilité et compléter les informations qui serviront à leurs futures mises en relation.</p>
              <p className="mt-4 text-sm font-semibold leading-7 text-seveno-brand-cyan-soft">Candidats : Seven’O est entièrement gratuit pour vous.</p>
              <Link href="/connexion" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-seveno-action-primary px-5 py-3 text-sm font-semibold text-seveno-text-on-accent transition hover:bg-seveno-action-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus">Créer mon profil candidat</Link>
            </article>
            <article className="flex flex-col rounded-[26px] border border-seveno-brand-blue/25 bg-white/[0.04] p-6">
              <h3 className="text-xl font-semibold text-seveno-text-primary">Demander un accès pilote</h3>
              <p className="mt-3 flex-1 text-sm leading-7 text-seveno-text-secondary">Les entreprises peuvent demander à découvrir Seven’O et préciser leurs premiers besoins de recrutement.</p>
              <p className="mt-4 text-sm font-semibold leading-7 text-seveno-brand-cyan-soft">Entreprises : recrutez sans abonnement, à partir de 390 € HT par campagne.</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/contact" className="inline-flex min-h-11 items-center justify-center rounded-full border border-seveno-brand-blue/40 bg-seveno-brand-blue/10 px-5 py-3 text-sm font-semibold text-seveno-text-primary transition hover:border-seveno-brand-blue/65 hover:bg-seveno-brand-blue/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus">Demander un accès entreprise</Link>
                <Link href="/entreprises/tarifs" className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-seveno-text-primary transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus">Voir les tarifs entreprises</Link>
              </div>
            </article>
          </div>
          <div className="mt-5 flex flex-col gap-4 border-y border-white/10 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-seveno-text-muted">ACCÈS SPÉCIALISÉ · AGENCES ET CABINETS</p>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-seveno-text-secondary">Présentez les usages nécessaires pour recruter pour le compte de plusieurs entreprises pendant la phase pilote.</p>
            </div>
            <Link href="/contact" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-seveno-text-primary transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus">Présenter mon besoin</Link>
          </div>
        </section>

        <section className="grid gap-8 border-y border-white/10 py-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <SectionHeading
            eyebrow="L’OBSERVATOIRE SEVEN’O"
            title={<><span className="text-seveno-brand-cyan">Comprendre</span> les <span className="text-seveno-brand-blue">écarts</span> pour mieux <span className="text-seveno-brand-cyan">rapprocher</span> les <span className="text-seveno-brand-blue">besoins</span>.</>}
            description="L’étude Seven’O constitue le premier socle d’un observatoire destiné à mieux comprendre les attentes des professionnels, les besoins des entreprises et les décalages entre les deux."
          />
          <Link href="/etude" className="inline-flex min-h-11 items-center justify-center rounded-full border border-seveno-brand-cyan/35 bg-seveno-brand-cyan/10 px-6 py-3 text-sm font-semibold text-seveno-text-primary transition hover:border-seveno-brand-cyan/60 hover:bg-seveno-brand-cyan/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus">Participer à l’étude Seven’O</Link>
          <p className="max-w-4xl text-sm leading-7 text-seveno-text-secondary lg:col-span-2">Les tendances seront exploitées uniquement sous forme agrégée et anonymisée. Les informations individuelles d’un candidat ne deviennent pas des données publiques.</p>
        </section>

        <section className="relative overflow-hidden rounded-[36px] border border-seveno-brand-cyan/25 bg-[radial-gradient(circle_at_top_right,rgb(var(--seveno-brand-blue)/0.2),transparent_34%),radial-gradient(circle_at_bottom_left,rgb(var(--seveno-brand-cyan)/0.16),transparent_32%),linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.94))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.34)] sm:p-8 lg:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">REJOINDRE SEVEN’O</p>
          <h2 aria-label="Évaluer mieux. Échanger au bon moment. Décider avec des éléments concrets." className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-seveno-text-primary sm:text-4xl lg:text-[2.75rem]"><span aria-hidden="true"><span className="text-seveno-brand-cyan">Évaluer</span> mieux. <span className="text-seveno-brand-blue">Échanger</span> au bon moment. <span className="text-seveno-brand-warm">Décider</span> avec des éléments <span className="text-seveno-brand-cyan">concrets</span>.</span></h2>
          <p className="mt-5 max-w-4xl text-base leading-8 text-seveno-text-secondary sm:text-lg">Seven’O ouvre progressivement ses premiers parcours avec des candidats, des entreprises et des professionnels du recrutement qui souhaitent expérimenter une autre manière de se rencontrer.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/connexion" className="inline-flex min-h-11 items-center justify-center rounded-full bg-seveno-action-primary px-6 py-3 text-sm font-semibold text-seveno-text-on-accent transition hover:bg-seveno-action-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus">Créer mon profil candidat</Link>
            <Link href="/contact" className="inline-flex min-h-11 items-center justify-center rounded-full border border-seveno-brand-blue/40 bg-seveno-brand-blue/10 px-6 py-3 text-sm font-semibold text-seveno-text-primary transition hover:border-seveno-brand-blue/65 hover:bg-seveno-brand-blue/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus">Demander un accès entreprise</Link>
            <Link href="/etude" className="inline-flex min-h-11 items-center justify-center px-4 py-3 text-sm font-semibold text-cyan-100 underline decoration-seveno-brand-cyan/50 underline-offset-4 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus">Participer à l’étude Seven’O</Link>
          </div>
        </section>

        <HomeFaqSection />
      </div>
    </PublicSiteShell>
  );
}
