import Image from 'next/image';
import Link from 'next/link';
import { LogoFeedbackPrompt } from '@/components/LogoFeedbackPrompt';
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
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 backdrop-blur">
            Étude privée sur invitation
          </div>
        </header>

        <section className="flex flex-1 flex-col items-center py-10 sm:py-12 lg:py-14">
          <div className="w-[min(320px,78vw)] sm:w-[min(420px,72vw)] lg:w-[min(520px,52vw)]">
            <Image
              src="/logo-seveno.png"
              alt="Seveno"
              width={1600}
              height={480}
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

          <div className="mt-10 grid w-full max-w-4xl gap-4 md:grid-cols-3">
            {valueCards.map((card) => (
              <article
                key={card.title}
                className="rounded-[22px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.35)] backdrop-blur"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-blue-500/35 to-violet-500/35 text-white/90">
                  <Icon name={card.icon} />
                </div>
                <h2 className="text-lg font-semibold text-white">{card.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">{card.description}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 w-full max-w-5xl">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Pourquoi répondre ?</h2>
            <div className="mt-6 grid gap-3 md:grid-cols-4">
              {reasons.map((reason, index) => (
                <div key={reason.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center">
                  <div
                    className={
                      'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-white/90 ' +
                      (index === 0
                        ? 'bg-blue-500/20'
                        : index === 1
                          ? 'bg-cyan-500/20'
                          : index === 2
                            ? 'bg-violet-500/20'
                            : 'bg-pink-500/20')
                    }
                  >
                    <Icon name={reason.icon} />
                  </div>
                  <p className="text-sm leading-6 text-slate-200">{reason.label}</p>
                </div>
              ))}
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
