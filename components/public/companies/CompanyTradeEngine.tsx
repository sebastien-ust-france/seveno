const engineSteps = [
  {
    number: '1',
    title: 'Définir le besoin réel',
    text: 'L’entreprise décrit le poste, ses missions et les compétences réellement nécessaires à son exercice.',
  },
  {
    number: '2',
    title: 'Distinguer les compétences des conditions',
    text: 'Les compétences métier sont évaluées. Les diplômes, permis, habilitations et autres justificatifs sont vérifiés séparément.',
  },
  {
    number: '3',
    title: 'Construire l’évaluation métier',
    text: 'Seven’O transforme les compétences et les missions de l’offre en questions directement liées aux réalités du poste.',
  },
  {
    number: '4',
    title: 'Confronter le candidat à des situations concrètes',
    text: 'Le candidat répond à des questions portant sur ses connaissances, ses méthodes, ses contrôles et ses décisions professionnelles.',
  },
  {
    number: '5',
    title: 'Éclairer la sélection',
    text: 'L’entreprise consulte les résultats avant d’engager la mise en relation et conserve la décision finale.',
  },
] as const;

const inputSignals = ['Compétences', 'Missions', 'Situations'] as const;
const outputSignals = ['Questions métier', 'Résultats lisibles', 'Décision humaine'] as const;

const stepLayoutClasses = [
  'md:col-start-1 md:row-start-1 xl:col-start-1 xl:row-start-1',
  'md:col-start-2 md:row-start-1 xl:col-start-1 xl:row-start-2',
  'md:col-span-2 md:row-start-2 xl:col-span-1 xl:col-start-2 xl:row-span-2 xl:row-start-1',
  'md:col-start-1 md:row-start-3 xl:col-start-3 xl:row-start-1',
  'md:col-start-2 md:row-start-3 xl:col-start-3 xl:row-start-2',
] as const;

function PeripheralStep({ step, side }: { step: (typeof engineSteps)[number]; side: 'input' | 'output' }) {
  const isInput = side === 'input';

  return (
    <article
      className={`relative z-10 flex h-full gap-4 rounded-[24px] border p-5 transition duration-200 md:flex-col md:hover:-translate-y-0.5 ${
        isInput
          ? 'border-seveno-assessment-general/25 bg-seveno-surface-panel md:hover:border-seveno-assessment-general/45'
          : 'border-seveno-brand-blue/30 bg-seveno-surface-panel md:hover:border-seveno-brand-blue/50'
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
          isInput
            ? 'border-seveno-assessment-general/35 bg-seveno-surface-active text-seveno-brand-cyan-soft'
            : 'border-seveno-brand-blue/40 bg-seveno-surface-active text-seveno-brand-blue'
        }`}
      >
        {step.number}
      </span>
      <div>
        <h3 className="text-lg font-semibold leading-7 text-seveno-text-primary">{step.title}</h3>
        <p className="mt-2 text-sm leading-6 text-seveno-text-secondary sm:text-base sm:leading-7">{step.text}</p>
      </div>
    </article>
  );
}

function EngineStep({ step }: { step: (typeof engineSteps)[number] }) {
  return (
    <article className="relative z-10 flex h-full flex-col overflow-hidden rounded-[30px] border border-seveno-brand-cyan/35 bg-gradient-to-br from-seveno-surface-elevated via-seveno-surface-active to-seveno-surface-panel p-5 shadow-2xl sm:p-7">
      <div className="relative flex flex-1 flex-col xl:min-h-[22rem]">
        <div aria-hidden="true" className="absolute inset-x-1 top-12 bottom-2 rounded-[50%] border border-seveno-brand-cyan/10 sm:inset-x-3" />
        <div aria-hidden="true" className="absolute inset-x-8 top-20 bottom-8 rounded-[50%] border border-seveno-brand-blue/10 sm:inset-x-12" />

        <div className="relative flex items-start justify-between gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-seveno-brand-cyan/40 bg-seveno-surface-active text-base font-semibold text-seveno-brand-cyan-soft">
            {step.number}
          </span>
          <p className="text-right text-xs font-semibold uppercase tracking-[0.22em] text-seveno-brand-cyan">Transformation centrale</p>
        </div>

        <div className="relative my-auto grid gap-5 py-7 sm:grid-cols-[1fr_auto_1fr] sm:items-center xl:gap-7 xl:py-9">
          <ul className="flex flex-wrap gap-2.5 sm:flex-col sm:items-end" aria-label="Entrées du moteur">
            {inputSignals.map((signal) => (
              <li key={signal} className="rounded-full border border-seveno-brand-cyan/25 bg-seveno-surface-active px-3 py-1.5 text-xs font-medium text-seveno-brand-cyan-soft xl:px-4 xl:py-2 xl:text-[0.8125rem]">
                {signal}
              </li>
            ))}
          </ul>

          <div className="flex min-h-28 min-w-28 items-center justify-center rounded-full border border-seveno-brand-blue/35 bg-seveno-surface-page px-4 text-center shadow-xl sm:min-h-32 sm:min-w-32 xl:min-h-40 xl:min-w-40 xl:px-6">
            <span className="text-sm font-semibold leading-6 text-seveno-text-primary xl:text-base">Moteur Seven’O</span>
          </div>

          <ul className="flex flex-wrap gap-2.5 sm:flex-col sm:items-start" aria-label="Sorties du moteur">
            {outputSignals.map((signal) => (
              <li
                key={signal}
                className={`rounded-full border bg-seveno-surface-active px-3 py-1.5 text-xs font-medium xl:px-4 xl:py-2 xl:text-[0.8125rem] ${
                  signal === 'Décision humaine'
                    ? 'border-seveno-brand-warm/40 text-seveno-brand-warm'
                    : 'border-seveno-brand-blue/30 text-seveno-brand-blue'
                }`}
              >
                {signal}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="relative mt-auto border-t border-seveno-border-subtle pt-7 pb-1">
        <h3 className="text-xl font-semibold leading-7 text-seveno-text-primary">{step.title}</h3>
        <p className="mt-3 text-base leading-7 text-seveno-text-secondary">{step.text}</p>
      </div>
    </article>
  );
}

export function CompanyTradeEngine() {
  return (
    <section
      id="moteur-seveno"
      className="scroll-mt-28 rounded-[34px] border border-seveno-brand-cyan/25 bg-gradient-to-b from-seveno-surface-section to-seveno-surface-page p-6 shadow-2xl sm:p-8 lg:p-10"
    >
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-10 xl:gap-14">
        <div className="lg:col-span-5">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">LE MOTEUR MÉTIER SEVEN’O</p>
          <h2 className="mt-4 text-[2rem] leading-[1.12] font-semibold tracking-tight text-seveno-text-primary sm:text-[2.375rem] lg:text-[2.75rem]">
            <span className="text-seveno-brand-cyan">Évaluez</span> les <span className="text-seveno-brand-cyan">compétences</span> avant de <span className="text-seveno-brand-cyan">sélectionner</span> le candidat.
          </h2>
        </div>
        <div className="space-y-4 text-base leading-7 text-seveno-text-secondary sm:text-lg sm:leading-8 lg:col-span-7 lg:pt-10">
          <p>
            Pour chaque offre, l’entreprise définit les compétences réellement nécessaires, les missions du poste et les situations professionnelles auxquelles la personne recrutée sera confrontée.
          </p>
          <p>
            Le moteur Seven’O transforme ce besoin en une évaluation métier propre à l’offre. Le candidat ne se contente plus d’affirmer qu’il sait faire ou de laisser son CV le suggérer : il répond à des questions portant sur des connaissances, des méthodes, des contrôles, des diagnostics et des décisions concrètes.
          </p>
        </div>
      </div>

      <div className="relative mt-10">
        <div aria-hidden="true" className="absolute top-7 bottom-7 left-[1.35rem] w-px bg-seveno-brand-cyan/20 md:hidden" />
        <div aria-hidden="true" className="absolute top-1/2 right-[25%] left-[25%] hidden h-px -translate-y-1/2 bg-gradient-to-r from-seveno-assessment-general/30 via-seveno-brand-blue/35 to-seveno-brand-blue-strong/40 xl:block" />
        <div aria-hidden="true" className="absolute top-[24%] bottom-[24%] left-[13.5%] hidden w-px bg-seveno-assessment-general/25 xl:block" />
        <div aria-hidden="true" className="absolute top-[24%] right-[13.5%] bottom-[24%] hidden w-px bg-seveno-brand-blue/30 xl:block" />

        <ol className="relative grid gap-4 md:grid-cols-2 xl:grid-cols-[27fr_46fr_27fr] xl:grid-rows-2 xl:gap-5">
          {engineSteps.map((step, index) => (
            <li key={step.number} className={stepLayoutClasses[index]}>
              {index === 2 ? <EngineStep step={step} /> : <PeripheralStep step={step} side={index < 2 ? 'input' : 'output'} />}
            </li>
          ))}
        </ol>
      </div>

      <aside
        className="mt-8 border-y border-seveno-border-subtle bg-seveno-surface-panel px-1 py-6 sm:px-3 lg:grid lg:grid-cols-12 lg:gap-8 lg:px-5 lg:py-8"
        aria-labelledby="evaluation-propre-au-poste"
      >
        <h3 id="evaluation-propre-au-poste" className="text-xl font-semibold leading-7 text-seveno-text-primary lg:col-span-4 lg:pr-6">
          Une évaluation construite pour le poste, pas un test générique
        </h3>
        <div className="mt-4 grid gap-4 text-base leading-7 text-seveno-text-secondary lg:col-span-8 lg:mt-0 lg:grid-cols-2 lg:gap-6 lg:border-l lg:border-seveno-border-subtle lg:pl-8">
          <p>
            Deux offres portant le même intitulé peuvent répondre à des besoins différents. Le questionnaire métier est donc construit à partir des compétences et des missions définies pour chaque recrutement.
          </p>
          <p>
            Seven’O ne cherche pas à déterminer si une personne est bonne ou mauvaise dans l’absolu. Il aide l’entreprise à comprendre si ses connaissances et ses raisonnements correspondent au besoin précis du poste proposé.
          </p>
        </div>
      </aside>

      <div className="mt-8 grid overflow-hidden rounded-[24px] border border-seveno-border-default sm:grid-cols-[1fr_auto_1.2fr] sm:items-stretch">
        <p className="bg-seveno-surface-panel px-5 py-5 text-base font-semibold leading-7 text-seveno-text-secondary sm:flex sm:items-center sm:px-6 sm:text-lg">
          Le CV explique ce que le candidat a fait.
        </p>
        <span aria-hidden="true" className="hidden items-center justify-center border-x border-seveno-border-subtle bg-seveno-surface-elevated px-4 text-seveno-brand-blue sm:flex">
          →
        </span>
        <p className="border-t border-seveno-border-subtle bg-seveno-surface-active px-5 py-5 text-base font-semibold leading-7 text-seveno-text-primary sm:flex sm:items-center sm:border-t-0 sm:px-6 sm:text-lg">
          Le moteur Seven’O évalue ce qu’il sait mobiliser pour le poste à pourvoir.
        </p>
      </div>
    </section>
  );
}
