const journeyStepsLeft = [
  {
    number: 1,
    title: 'Créez votre compte',
    text: 'Votre identité et vos coordonnées sont conservées dans votre espace privé.',
  },
  {
    number: 2,
    title: 'Définissez votre projet',
    text: 'Indiquez les métiers recherchés, votre zone, votre niveau d’expérience et vos préférences professionnelles.',
  },
  {
    number: 3,
    title: 'Précisez votre disponibilité',
    text: 'Préparez votre profil aujourd’hui, que vous soyez disponible maintenant, dans un mois, dans trois mois ou plus tard.',
  },
  {
    number: 4,
    title: 'Complétez le questionnaire Seven’O',
    text: 'Le questionnaire d’aptitudes générales enrichit la lecture de votre profil sans produire de décision automatique à votre place.',
  },
] as const;

const journeyStepsRight = [
  {
    number: 5,
    title: 'Réunissez vos recommandations',
    text: 'Demandez plusieurs recommandations indépendantes à d’anciens employeurs, responsables ou partenaires professionnels. Elles restent facultatives.',
  },
  {
    number: 6,
    title: 'Découvrez les opportunités qui correspondent',
    text: 'À mesure que les entreprises rejoignent Seven’O, vous pouvez découvrir des besoins cohérents avec votre recherche et votre disponibilité.',
  },
  {
    number: 7,
    title: 'Répondez aux critères du poste',
    text: 'Vous confirmez les prérequis puis répondez, lorsqu’il existe, au questionnaire ciblé préparé par l’entreprise.',
  },
  {
    number: 8,
    title: 'Avancez après un intérêt mutuel',
    text: 'Lorsque vous et l’entreprise souhaitez poursuivre, la conversation s’ouvre et les identités sont révélées selon les validations prévues.',
  },
] as const;

function JourneyStep({
  number,
  title,
  text,
}: {
  number: number;
  title: string;
  text: string;
}) {
  return (
    <li className="relative pl-11">
      <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 text-sm font-semibold text-cyan-100">
        {number}
      </span>
      <div className="border-l border-white/10 pb-5 pl-5 last:pb-0">
        <h3 className="text-lg font-semibold leading-7 text-white">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-slate-300">{text}</p>
      </div>
    </li>
  );
}

function JourneyColumn({ steps }: { steps: readonly { number: number; title: string; text: string }[] }) {
  return (
    <ol className="relative space-y-4 before:absolute before:inset-y-2 before:left-4 before:w-px before:bg-gradient-to-b before:from-cyan-300/20 before:via-white/10 before:to-transparent">
      {steps.map((step) => (
        <JourneyStep key={step.number} number={step.number} title={step.title} text={step.text} />
      ))}
    </ol>
  );
}

export function CandidateJourney() {
  return (
    <section
      id="parcours-candidat"
      className="rounded-[34px] border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(10,16,31,0.96),rgba(8,15,28,0.92))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.28)] sm:p-8 lg:p-10"
    >
      <div className="space-y-5">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">VOTRE PARCOURS CANDIDAT</p>
        <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          De la création du compte à la rencontre.
        </h2>
        <p className="max-w-4xl text-lg leading-8 text-slate-300">
          Chaque étape complète la précédente. Vous gardez la maîtrise de votre profil et vous décidez toujours si vous souhaitez poursuivre.
        </p>
        <p className="max-w-4xl text-lg leading-8 text-slate-300">
          Le parcours comporte exactement huit étapes.
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <JourneyColumn steps={journeyStepsLeft} />
        <JourneyColumn steps={journeyStepsRight} />
      </div>
    </section>
  );
}
