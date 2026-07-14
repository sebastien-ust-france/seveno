import Image from 'next/image';
import Link from 'next/link';
import { LogoFeedbackPrompt } from '@/components/LogoFeedbackPrompt';
import { HomeAccountButton } from '@/components/navigation/HomeAccountButton';
import {
  SEVENO_LOGO_ALT,
  SEVENO_LOGO_HEIGHT,
  SEVENO_LOGO_SRC,
  SEVENO_LOGO_WIDTH,
} from '@/lib/branding';
import { getPublicStudyResponseCount } from '@/lib/study-public';

export const dynamic = 'force-dynamic';

const valueCards = [
  {
    icon: 'target',
    title: 'Étude de marché',
    description: 'Votre retour permettra de construire une plateforme plus pertinente.',
  },
  {
    icon: 'clock',
    title: 'Questionnaire rapide',
    description: '3 à 5 minutes suffisent pour participer.',
  },
  {
    icon: 'shield',
    title: 'Participation gratuite',
    description: 'Aucun engagement. Vos réponses sont utilisées uniquement pour améliorer Seveno.',
  },
] as const;

const reasons = [
  {
    icon: 'users',
    label: 'Contribuer à la création de Seveno',
  },
  {
    icon: 'bell',
    label: 'Être informé du lancement',
  },
  {
    icon: 'star',
    label: 'Devenir bêta-testeur',
  },
  {
    icon: 'heart',
    label: 'Aider à construire une plateforme adaptée au marché',
  },
] as const;

type IconName = (typeof valueCards)[number]['icon'] | (typeof reasons)[number]['icon'];

const futureModelCards = [
  {
    number: '01',
    title: 'L’entreprise définit son besoin réel',
    description:
      "Poste recherché, attentes terrain, compétences utiles, contraintes du métier, critères prioritaires : l’entreprise clarifie ce qu’elle veut réellement évaluer.",
  },
  {
    number: '02',
    title: 'Un questionnaire ciblé est préparé',
    description:
      "L’entreprise construit un questionnaire adapté au poste. Seven’O permet de structurer les questions, de limiter le temps de réponse et de faire varier une partie des questions pour réduire les réponses automatisées ou trop préparées.",
  },
  {
    number: '03',
    title: 'Les profils sont qualifiés autrement',
    description:
      "Le recruteur ne reçoit pas seulement un CV. Il dispose aussi de réponses concrètes, d’un score et de signaux d’adéquation avec le besoin exprimé par l’entreprise.",
  },
  {
    number: '04',
    title: 'Le recrutement devient plus lisible',
    description:
      "Moins de tri inutile, moins de candidatures hors sujet, plus de profils réellement proches du poste à pourvoir. Le questionnaire peut être conservé, ajusté et réutilisé lors des prochains recrutements.",
  },
] as const;

const futureModelCardStyles = [
  {
    card:
      'border-cyan-400/15 bg-[linear-gradient(180deg,rgba(10,17,32,0.96),rgba(8,15,28,0.92))] shadow-[0_20px_60px_rgba(2,6,23,0.22)] transition-all duration-300 ease-out transform-gpu md:hover:-translate-y-0.5 md:hover:border-cyan-300/25 md:hover:shadow-[0_28px_80px_rgba(34,211,238,0.08),0_24px_80px_rgba(2,6,23,0.42)]',
    number:
      'border-cyan-300/25 bg-cyan-400/10 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_0_24px_rgba(34,211,238,0.12)]',
    line: 'bg-gradient-to-r from-cyan-300 via-blue-300/70 to-transparent',
  },
  {
    card:
      'border-violet-400/15 bg-[linear-gradient(180deg,rgba(13,14,34,0.96),rgba(8,15,28,0.92))] shadow-[0_20px_60px_rgba(2,6,23,0.22)] transition-all duration-300 ease-out transform-gpu md:hover:-translate-y-0.5 md:hover:border-violet-300/25 md:hover:shadow-[0_28px_80px_rgba(139,92,246,0.08),0_24px_80px_rgba(2,6,23,0.42)]',
    number:
      'border-violet-300/25 bg-violet-400/10 text-violet-100 shadow-[0_0_0_1px_rgba(139,92,246,0.10),0_0_24px_rgba(139,92,246,0.12)]',
    line: 'bg-gradient-to-r from-violet-300 via-indigo-300/70 to-transparent',
  },
  {
    card:
      'border-orange-400/15 bg-[linear-gradient(180deg,rgba(18,15,24,0.96),rgba(8,15,28,0.92))] shadow-[0_20px_60px_rgba(2,6,23,0.22)] transition-all duration-300 ease-out transform-gpu md:hover:-translate-y-0.5 md:hover:border-orange-300/25 md:hover:shadow-[0_28px_80px_rgba(249,115,22,0.08),0_24px_80px_rgba(2,6,23,0.42)]',
    number:
      'border-orange-300/25 bg-orange-400/10 text-orange-100 shadow-[0_0_0_1px_rgba(249,115,22,0.10),0_0_24px_rgba(249,115,22,0.12)]',
    line: 'bg-gradient-to-r from-orange-300 via-amber-200/70 to-transparent',
  },
  {
    card:
      'border-cyan-400/14 bg-[linear-gradient(180deg,rgba(10,17,32,0.96),rgba(8,15,28,0.92))] shadow-[0_20px_60px_rgba(2,6,23,0.22)] transition-all duration-300 ease-out transform-gpu md:hover:-translate-y-0.5 md:hover:border-cyan-300/25 md:hover:shadow-[0_28px_80px_rgba(34,211,238,0.08),0_24px_80px_rgba(2,6,23,0.42)]',
    number:
      'border-orange-300/25 bg-orange-400/10 text-orange-100 shadow-[0_0_0_1px_rgba(249,115,22,0.10),0_0_24px_rgba(249,115,22,0.12)]',
    line: 'bg-gradient-to-r from-cyan-300 via-violet-300/70 to-transparent',
  },
] as const;

const valueCardStyles = [
  {
    card:
      'border-cyan-400/12 bg-[linear-gradient(180deg,rgba(9,17,32,0.95),rgba(8,15,28,0.9))] shadow-[0_18px_60px_rgba(2,6,23,0.28)] transition-all duration-300 ease-out transform-gpu md:hover:-translate-y-0.5 md:hover:border-cyan-300/25 md:hover:shadow-[0_24px_70px_rgba(34,211,238,0.08),0_18px_60px_rgba(2,6,23,0.38)]',
    icon:
      'border-cyan-300/20 bg-gradient-to-br from-cyan-500/25 via-blue-500/20 to-violet-500/12 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_0_26px_rgba(34,211,238,0.12)]',
  },
  {
    card:
      'border-violet-400/12 bg-[linear-gradient(180deg,rgba(12,14,34,0.95),rgba(8,15,28,0.9))] shadow-[0_18px_60px_rgba(2,6,23,0.28)] transition-all duration-300 ease-out transform-gpu md:hover:-translate-y-0.5 md:hover:border-violet-300/25 md:hover:shadow-[0_24px_70px_rgba(139,92,246,0.08),0_18px_60px_rgba(2,6,23,0.38)]',
    icon:
      'border-violet-300/20 bg-gradient-to-br from-violet-500/25 via-indigo-500/20 to-cyan-500/12 text-violet-100 shadow-[0_0_0_1px_rgba(139,92,246,0.10),0_0_26px_rgba(139,92,246,0.12)]',
  },
  {
    card:
      'border-orange-400/12 bg-[linear-gradient(180deg,rgba(18,15,24,0.95),rgba(8,15,28,0.9))] shadow-[0_18px_60px_rgba(2,6,23,0.28)] transition-all duration-300 ease-out transform-gpu md:hover:-translate-y-0.5 md:hover:border-orange-300/25 md:hover:shadow-[0_24px_70px_rgba(249,115,22,0.08),0_18px_60px_rgba(2,6,23,0.38)]',
    icon:
      'border-orange-300/20 bg-gradient-to-br from-orange-500/22 via-amber-500/18 to-violet-500/10 text-orange-100 shadow-[0_0_0_1px_rgba(249,115,22,0.10),0_0_26px_rgba(249,115,22,0.12)]',
  },
] as const;

const reasonCardStyles = [
  {
    card:
      'border-cyan-400/12 bg-[linear-gradient(180deg,rgba(9,17,32,0.94),rgba(8,15,28,0.9))] shadow-[0_18px_60px_rgba(2,6,23,0.25)] transition-all duration-300 ease-out transform-gpu md:hover:-translate-y-0.5 md:hover:border-cyan-300/25 md:hover:shadow-[0_24px_70px_rgba(34,211,238,0.08),0_18px_60px_rgba(2,6,23,0.38)]',
    icon:
      'border-cyan-300/20 bg-gradient-to-br from-cyan-500/20 via-blue-500/18 to-violet-500/10 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_0_22px_rgba(34,211,238,0.10)]',
  },
  {
    card:
      'border-violet-400/12 bg-[linear-gradient(180deg,rgba(12,14,34,0.94),rgba(8,15,28,0.9))] shadow-[0_18px_60px_rgba(2,6,23,0.25)] transition-all duration-300 ease-out transform-gpu md:hover:-translate-y-0.5 md:hover:border-violet-300/25 md:hover:shadow-[0_24px_70px_rgba(139,92,246,0.08),0_18px_60px_rgba(2,6,23,0.38)]',
    icon:
      'border-violet-300/20 bg-gradient-to-br from-violet-500/20 via-indigo-500/18 to-cyan-500/10 text-violet-100 shadow-[0_0_0_1px_rgba(139,92,246,0.08),0_0_22px_rgba(139,92,246,0.10)]',
  },
  {
    card:
      'border-orange-400/12 bg-[linear-gradient(180deg,rgba(18,15,24,0.94),rgba(8,15,28,0.9))] shadow-[0_18px_60px_rgba(2,6,23,0.25)] transition-all duration-300 ease-out transform-gpu md:hover:-translate-y-0.5 md:hover:border-orange-300/25 md:hover:shadow-[0_24px_70px_rgba(249,115,22,0.08),0_18px_60px_rgba(2,6,23,0.38)]',
    icon:
      'border-orange-300/20 bg-gradient-to-br from-orange-500/18 via-amber-500/16 to-violet-500/10 text-orange-100 shadow-[0_0_0_1px_rgba(249,115,22,0.08),0_0_22px_rgba(249,115,22,0.10)]',
  },
  {
    card:
      'border-cyan-400/12 bg-[linear-gradient(180deg,rgba(9,17,32,0.94),rgba(8,15,28,0.9))] shadow-[0_18px_60px_rgba(2,6,23,0.25)] transition-all duration-300 ease-out transform-gpu md:hover:-translate-y-0.5 md:hover:border-cyan-300/25 md:hover:shadow-[0_24px_70px_rgba(34,211,238,0.08),0_18px_60px_rgba(2,6,23,0.38)]',
    icon:
      'border-cyan-300/20 bg-gradient-to-br from-cyan-500/18 via-violet-500/16 to-orange-500/10 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_0_22px_rgba(34,211,238,0.10)]',
  },
] as const;

function formatParticipationMessage(totalResponses: number) {
  if (totalResponses <= 0) {
    return "Soyez le premier à participer à l'étude.";
  }

  if (totalResponses === 1) {
    return "1 personne a déjà participé à l'étude Seveno.";
  }

  return `${totalResponses} personnes ont déjà participé à l'étude Seveno.`;
}

function Icon({ name }: { name: IconName }) {
  const className = 'h-5 w-5';

  switch (name) {
    case 'target':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <circle cx="12" cy="12" r="7.5" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
          <path d="M12 2.5v3.5M21.5 12H18M12 21.5V18M6 6l2.4 2.4M18 18l-2.4-2.4" strokeLinecap="round" />
        </svg>
      );
    case 'clock':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M12 3.5 18.5 6v5.2c0 4.3-2.8 7.4-6.5 9.3-3.7-1.9-6.5-5-6.5-9.3V6L12 3.5Z" />
          <path d="m9.5 12 1.8 1.8 3.2-3.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'users':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M16.5 17c1.9 0 3.5 1 4.5 2.5" strokeLinecap="round" />
          <circle cx="9" cy="9" r="3.2" />
          <path d="M3.5 19c.9-2.9 3-4.5 5.5-4.5S13.6 16.1 14.5 19" strokeLinecap="round" />
          <path d="M16 9c.7 0 1.4.1 2 .4" strokeLinecap="round" />
        </svg>
      );
    case 'bell':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M12 4.5a4 4 0 0 0-4 4v2.2c0 1.1-.4 2.1-1.1 2.9L5.3 15h13.4l-1.6-1.4c-.7-.8-1.1-1.8-1.1-2.9V8.5a4 4 0 0 0-4-4Z" />
          <path d="M10.5 18.2a1.8 1.8 0 0 0 3 0" strokeLinecap="round" />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="m12 3.8 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L12 3.8Z" />
        </svg>
      );
    case 'heart':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M12 20.3 4.6 12.8a4.2 4.2 0 0 1 6-6l1.4 1.4 1.4-1.4a4.2 4.2 0 0 1 6 6L12 20.3Z" />
        </svg>
      );
  }
}

export default async function HomePage() {
  const publicStudyCount = await getPublicStudyResponseCount();

  return (
    <main className="min-h-screen bg-[#020817] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-end border-b border-white/10 pb-5">
          <HomeAccountButton />
        </header>

        <section className="flex flex-1 flex-col items-center py-10 sm:py-12 lg:py-14">
          <div className="w-[min(320px,78vw)] sm:w-[min(420px,72vw)] lg:w-[min(520px,52vw)]">
            <Image
              src={SEVENO_LOGO_SRC}
              alt={SEVENO_LOGO_ALT}
              width={SEVENO_LOGO_WIDTH}
              height={SEVENO_LOGO_HEIGHT}
              priority
              sizes="(max-width: 640px) 78vw, (max-width: 1024px) 72vw, 520px"
              className="h-auto w-full"
            />
          </div>

          <div className="mt-6 w-full max-w-4xl">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-[0_24px_90px_rgba(2,6,23,0.45)] backdrop-blur sm:p-6">
              <LogoFeedbackPrompt />
            </div>
          </div>

          <div className="mt-10 w-full max-w-4xl text-center">
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-blue-300">Étude de marché</p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Nous construisons Seveno avec vous.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300">
              Seveno prépare une nouvelle façon de mettre en relation les professionnels, les entreprises et les
              cabinets de recrutement.
            </p>
            <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              Avant son lancement, nous réalisons une étude de marché afin de construire une plateforme réellement
              adaptée à vos besoins.
            </p>
          </div>

          <div className="mt-10 w-full max-w-3xl rounded-[22px] border border-white/10 bg-white/5 px-5 py-4 text-center shadow-[0_18px_60px_rgba(2,6,23,0.3)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-300">Étude Seveno en cours</p>
            <p className="mt-3 text-lg font-medium text-white">
              {formatParticipationMessage(publicStudyCount.totalResponses)}
            </p>
          </div>

          <div className="mt-10 w-full max-w-5xl">
            <section className="relative overflow-hidden rounded-[32px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.96),rgba(8,15,28,0.92))] px-5 py-6 shadow-[0_24px_80px_rgba(2,6,23,0.34)] backdrop-blur sm:px-6 sm:py-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.12),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.08),transparent_28%)]" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />

              <div className="relative">
                <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-200/90">
                  Vision produit
                </p>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Comment Seven’O pourrait fonctionner demain ?
                </h2>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
                  Seven’O explore une autre façon de rapprocher les professionnels, les entreprises, les cabinets de
                  recrutement et les agences d’intérim : moins dépendante du CV seul, davantage centrée sur
                  l’adéquation réelle entre un poste, des compétences et des réponses concrètes.
                </p>

                <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {futureModelCards.map((card, index) => {
                    const style = futureModelCardStyles[index % futureModelCardStyles.length];

                    return (
                    <article
                      key={card.title}
                      className={'group relative overflow-hidden rounded-[22px] border p-5 ' + style.card}
                    >
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0)_24%),radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_64%)]"
                      />
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
                      />
                      <div className="relative z-10">
                      <div className="flex items-center gap-3">
                        <span
                          className={
                            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tracking-[0.24em] ' +
                            style.number
                          }
                        >
                          {card.number}
                        </span>
                        <span className={'h-px flex-1 ' + style.line} />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-white">{card.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{card.description}</p>
                      </div>
                    </article>
                    );
                  })}
                </div>

                <p className="mt-6 max-w-4xl text-sm leading-7 text-slate-200">
                  Seven’O ne remplace pas le recruteur. Seven’O l’aide à mieux identifier les profils qui
                  correspondent réellement au poste, avant l’échange humain.
                </p>
              </div>
            </section>

            <section className="relative mt-5 overflow-hidden rounded-[24px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.95),rgba(8,15,28,0.9))] px-5 py-5 shadow-[0_18px_60px_rgba(2,6,23,0.22)] backdrop-blur sm:px-6">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-[24px] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.09),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.08),transparent_36%),radial-gradient(circle_at_top_left,rgba(249,115,22,0.05),transparent_28%)]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent"
              />
              <div className="relative z-10 flex items-start gap-4">
                <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.14),rgba(139,92,246,0.10),rgba(249,115,22,0.08))] shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_0_28px_rgba(34,211,238,0.08)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-cyan-300 via-blue-300 to-violet-300 shadow-[0_0_0_6px_rgba(34,211,238,0.12)]" />
                </div>
                <div className="space-y-2">
                  <p className="text-base font-semibold text-white">
                    Un observatoire des talents et des besoins du marché
                  </p>
                  <p className="text-sm leading-7 text-slate-300">
                    Au-delà du recrutement, Seven’O a aussi vocation à faire émerger des signaux utiles : métiers
                    recherchés, compétences disponibles, attentes des candidats, difficultés de recrutement, zones
                    géographiques, écarts entre besoins des entreprises et profils présents sur le marché.
                  </p>
                  <p className="text-sm leading-7 text-slate-300">
                    Ce pilier pourra intéresser les entreprises, les cabinets, les agences d’intérim, mais aussi les
                    organisations qui souhaitent mieux comprendre l’évolution des talents et des besoins
                    professionnels.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-10 grid w-full max-w-4xl gap-4 rounded-[32px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(10,15,28,0.92),rgba(8,15,28,0.84))] p-4 shadow-[0_18px_60px_rgba(2,6,23,0.22)] backdrop-blur md:grid-cols-3 sm:p-5">
            {valueCards.map((card, index) => {
              const style = valueCardStyles[index % valueCardStyles.length];

              return (
                <article
                  key={card.title}
                  className={'group relative overflow-hidden rounded-[22px] border p-5 ' + style.card}
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0)_24%),radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_64%)]"
                  />
                  <div className="relative z-10">
                    <div className={'mb-5 flex h-11 w-11 items-center justify-center rounded-full border ' + style.icon}>
                      <Icon name={card.icon} />
                    </div>
                    <h2 className="text-lg font-semibold text-white">{card.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{card.description}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-10 w-full max-w-5xl rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,15,28,0.92),rgba(8,15,28,0.86))] p-5 shadow-[0_20px_70px_rgba(2,6,23,0.24)] backdrop-blur">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Pourquoi répondre ?</h2>
            <div className="mt-6 grid gap-3 md:grid-cols-4">
              {reasons.map((reason, index) => {
                const style = reasonCardStyles[index % reasonCardStyles.length];

                return (
                  <div
                    key={reason.label}
                    className={'group relative overflow-hidden rounded-2xl border px-4 py-5 text-center ' + style.card}
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0)_26%),radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_64%)]"
                    />
                    <div className="relative z-10">
                      <div className={'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border text-white/90 ' + style.icon}>
                        <Icon name={reason.icon} />
                      </div>
                      <p className="text-sm leading-6 text-slate-200">{reason.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-10 w-full max-w-4xl text-center">
            <Link
              href="/etude"
              className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-7 py-4 text-base font-semibold text-white shadow-[0_18px_50px_rgba(99,102,241,0.35)] transition hover:-translate-y-0.5 hover:brightness-110 sm:w-auto sm:min-w-[320px]"
            >
              Participer à l&apos;étude
            </Link>
            <p className="mt-4 text-sm text-slate-400">Temps moyen : 3 à 5 minutes</p>
          </div>

          <div className="mt-10 w-full max-w-4xl rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 text-center text-sm leading-6 text-slate-300 backdrop-blur">
            Vos réponses restent confidentielles et sont utilisées uniquement dans le cadre de cette étude de marché.
          </div>
        </section>

        <footer className="border-t border-white/10 py-5 text-sm leading-6 text-slate-400">
          <p>Seveno collecte des signaux marché avant le lancement.</p>
          <p className="mt-2">
            Seveno fait partie de l&apos;écosystème{' '}
            <a
              href="https://ust-workflow.fr/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-300 transition-colors hover:text-slate-100"
            >
              UST-Workflow
            </a>
            .
          </p>
        </footer>
      </div>
    </main>
  );
}
