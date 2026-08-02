const companyConsequences = [
  'Le temps consacré au tri, aux échanges et aux entretiens',
  'L’organisation de l’arrivée et de l’intégration',
  'La mobilisation du responsable et des collaborateurs',
  'La formation et l’accompagnement de la personne recrutée',
  'Les erreurs, retards ou objectifs qui peuvent ne pas être atteints',
  'La nécessité de recommencer tout ou partie du recrutement',
] as const;

const candidateConsequences = [
  'Une prise de poste interrompue pendant ou après la période d’essai',
  'Une nouvelle recherche d’emploi à engager',
  'Une expérience professionnelle devenue difficile à expliquer',
  'Le sentiment de ne pas avoir été à la hauteur',
  'Une perte de confiance dans ses propres compétences',
] as const;

type ConsequencePanelProps = {
  title: string;
  introduction: string;
  consequences: readonly string[];
  conclusion: string;
  tone: 'company' | 'candidate';
};

function ConsequencePanel({ title, introduction, consequences, conclusion, tone }: ConsequencePanelProps) {
  const accentClass = tone === 'company' ? 'border-seveno-company/35' : 'border-seveno-candidate/35';
  const markerClass = tone === 'company' ? 'bg-seveno-company' : 'bg-seveno-candidate';
  const titleClass = tone === 'company' ? 'text-seveno-company' : 'text-seveno-candidate';

  return (
    <article className={`flex h-full flex-col rounded-[28px] border bg-seveno-surface-panel p-5 sm:p-6 ${accentClass}`}>
      <h3 className={`text-2xl font-semibold tracking-tight ${titleClass}`}>{title}</h3>
      <p className="mt-4 text-base leading-7 text-seveno-text-secondary">{introduction}</p>
      <ul className="mt-5 space-y-3 text-base leading-7 text-seveno-text-secondary">
        {consequences.map((consequence) => (
          <li key={consequence} className="flex gap-3">
            <span aria-hidden="true" className={`mt-3 h-1.5 w-1.5 shrink-0 rounded-full ${markerClass}`} />
            <span>{consequence}</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 border-t border-seveno-border-subtle pt-5 text-base font-semibold leading-7 text-seveno-text-primary">{conclusion}</p>
    </article>
  );
}

export function CompanyEvaluationConsequences() {
  return (
    <section
      id="consequences-mauvaise-evaluation"
      className="scroll-mt-28 p-6 sm:p-8 lg:p-10"
    >
      <div className="max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-blue">LES CONSÉQUENCES</p>
        <h2 className="mt-4 text-[2rem] leading-[1.12] font-semibold tracking-tight text-seveno-text-primary sm:text-[2.375rem] lg:text-[2.75rem]">
          Une mauvaise <span className="text-seveno-brand-cyan">évaluation</span> <span className="text-seveno-brand-cyan">coûte</span> aux deux <span className="text-seveno-brand-cyan">parties</span>.
        </h2>
        <p className="mt-5 max-w-3xl text-base leading-7 text-seveno-text-secondary sm:text-lg sm:leading-8">
          Lorsque l’inadéquation avec le poste n’apparaît qu’après l’embauche, l’entreprise et le candidat ont déjà engagé du temps, de l’énergie et des moyens dans une relation qui reposait peut-être sur une évaluation incomplète.
        </p>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2 lg:items-stretch">
        <ConsequencePanel
          title="Pour l’entreprise"
          introduction="L’erreur est rarement limitée au coût du recrutement. Elle intervient après plusieurs étapes qui ont déjà mobilisé l’organisation."
          consequences={companyConsequences}
          conclusion="Lorsque l’écart est découvert après plusieurs semaines ou plusieurs mois, une grande partie de ces ressources a déjà été engagée."
          tone="company"
        />
        <ConsequencePanel
          title="Pour le candidat"
          introduction="Le candidat subit lui aussi les conséquences d’une sélection qui n’a peut-être pas évalué les bons éléments."
          consequences={candidateConsequences}
          conclusion="Il peut finir par croire qu’il n’est pas compétent, alors qu’il a peut-être simplement été recruté à partir d’une mauvaise évaluation de son adéquation avec le poste."
          tone="candidate"
        />
      </div>

      <div className="mt-6 rounded-[24px] border border-seveno-brand-blue/25 bg-seveno-surface-active px-5 py-5 text-center sm:px-8 sm:py-6">
        <p className="text-lg font-semibold leading-8 text-seveno-text-primary sm:text-xl">
          Une erreur de recrutement peut être la conséquence d’une mauvaise évaluation, et non d’une absence de compétences.
        </p>
      </div>

      <p className="mx-auto mt-5 max-w-4xl text-center text-base leading-7 text-seveno-text-secondary sm:text-lg sm:leading-8">
        Pour réduire ce risque, l’évaluation doit intervenir avant la sélection, à partir des compétences et des situations réellement liées au poste.
      </p>
    </section>
  );
}
