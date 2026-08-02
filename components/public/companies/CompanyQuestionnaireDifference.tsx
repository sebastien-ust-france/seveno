const generalAssessmentItems = [
  'Compréhension de l’information',
  'Analyse et prise de décision',
  'Organisation de l’action',
  'Adaptation au contexte professionnel',
] as const;

const tradeAssessmentItems = [
  'Connaissances utiles au poste',
  'Méthodes de travail attendues',
  'Contrôles et diagnostics métier',
  'Décisions face à des situations concrètes',
] as const;

type AssessmentPanelProps = {
  number: string;
  eyebrow: string;
  title: string;
  paragraphs: readonly [string, string];
  items: readonly string[];
  conclusion: string;
  tone: 'general' | 'trade';
};

function AssessmentPanel({ number, eyebrow, title, paragraphs, items, conclusion, tone }: AssessmentPanelProps) {
  const isGeneral = tone === 'general';

  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-[30px] border p-5 sm:p-7 ${
        isGeneral
          ? 'border-seveno-assessment-general/30 bg-seveno-surface-panel'
          : 'border-seveno-brand-blue/40 bg-seveno-surface-panel'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${isGeneral ? 'text-seveno-assessment-general' : 'text-seveno-brand-blue'}`}>
          {eyebrow}
        </p>
        <span
          aria-hidden="true"
          className={`text-3xl font-semibold tracking-[-0.05em] ${isGeneral ? 'text-seveno-assessment-general/40' : 'text-seveno-brand-blue/50'}`}
        >
          {number}
        </span>
      </div>

      <h3 className="mt-4 text-2xl font-semibold leading-8 tracking-tight text-seveno-text-primary">{title}</h3>
      <div className="mt-5 space-y-3 text-base leading-7 text-seveno-text-secondary">
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <ul className="mt-6 space-y-3 border-y border-seveno-border-subtle py-5 text-base leading-7 text-seveno-text-secondary">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span
              aria-hidden="true"
              className={`mt-3 h-1.5 w-1.5 shrink-0 rounded-full ${isGeneral ? 'bg-seveno-assessment-general' : 'bg-seveno-brand-blue'}`}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <p className={`mt-5 text-base font-semibold leading-7 ${isGeneral ? 'text-seveno-brand-cyan-soft' : 'text-seveno-brand-blue'}`}>
        {conclusion}
      </p>
    </article>
  );
}

export function CompanyQuestionnaireDifference() {
  return (
    <section
      id="deux-evaluations"
      className="scroll-mt-28 rounded-[34px] border border-seveno-border-default bg-seveno-surface-section p-6 shadow-2xl sm:p-8 lg:p-10"
    >
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-6">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">DEUX ÉVALUATIONS COMPLÉMENTAIRES</p>
          <h2 className="mt-4 text-[2rem] leading-[1.12] font-semibold tracking-tight text-seveno-text-primary sm:text-[2.375rem] lg:text-[2.75rem]">
            <span className="text-seveno-brand-cyan">Comprendre</span> la manière de <span className="text-seveno-brand-cyan">travailler</span>, puis <span className="text-seveno-brand-cyan">évaluer</span> l’adéquation avec le <span className="text-seveno-brand-cyan">poste</span>.
          </h2>
        </div>
        <div className="space-y-4 text-base leading-7 text-seveno-text-secondary sm:text-lg sm:leading-8 lg:col-span-6 lg:pt-9">
          <p>
            Seven’O ne réduit pas un candidat à un seul résultat. Deux questionnaires apportent des éclairages différents, à des moments distincts du parcours.
          </p>
          <p>
            Le premier aide à comprendre des aptitudes professionnelles transversales. Le second confronte le candidat aux connaissances, méthodes et décisions directement liées à l’offre.
          </p>
        </div>
      </div>

      <div className="mt-9 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(10rem,0.48fr)_minmax(0,1fr)] lg:items-stretch">
        <AssessmentPanel
          number="01"
          eyebrow="LE SOCLE TRANSVERSAL"
          title="Le questionnaire général Seven’O"
          paragraphs={[
            'Il apporte une lecture commune de la manière dont le candidat comprend une information, analyse une situation, organise son action et réagit dans un contexte professionnel.',
            'Il est indépendant du métier et du secteur. Il ne cherche pas à vérifier une compétence technique propre à l’offre.',
          ]}
          items={generalAssessmentItems}
          conclusion="Il aide à comprendre le profil professionnel sans prétendre résumer la personne à une note."
          tone="general"
        />

        <div className="relative flex flex-col items-center justify-center px-2 py-3 text-center lg:px-3">
          <div aria-hidden="true" className="flex w-full items-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-seveno-assessment-general/35" />
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-seveno-border-strong bg-seveno-surface-elevated text-lg font-semibold text-seveno-text-primary">
              +
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-seveno-brand-blue/40 to-transparent" />
          </div>
          <h3 className="mt-5 text-lg font-semibold leading-7 text-seveno-text-primary">Deux lectures, une décision plus éclairée</h3>
          <p className="mt-3 text-sm leading-6 text-seveno-text-secondary">
            Le questionnaire général aide à comprendre comment le candidat aborde le travail. Le questionnaire métier permet d’évaluer son adéquation avec le besoin précis de l’entreprise.
          </p>
        </div>

        <AssessmentPanel
          number="02"
          eyebrow="L’ÉVALUATION CONTEXTUELLE"
          title="Le questionnaire métier propre à l’offre"
          paragraphs={[
            'Il est construit à partir des compétences, des missions et des situations réellement définies par l’entreprise pour le poste à pourvoir.',
            'Il évalue ce que le candidat sait mobiliser face à des questions de connaissance, de méthode, de contrôle, de diagnostic et de décision professionnelle.',
          ]}
          items={tradeAssessmentItems}
          conclusion="Il ne demande pas au candidat d’affirmer qu’il sait faire : il l’amène à répondre face aux réalités du poste."
          tone="trade"
        />
      </div>

      <p className="mt-6 rounded-[22px] border border-seveno-border-default bg-seveno-surface-panel px-5 py-5 text-center text-base font-semibold leading-7 text-seveno-text-primary sm:px-8 sm:text-lg sm:leading-8">
        L’un éclaire le profil. L’autre évalue le poste. Aucun des deux ne décide à la place de l’entreprise.
      </p>
    </section>
  );
}
