const assistedSteps = [
  {
    title: 'Seven’O prépare',
    text: 'Une première version construite à partir de l’offre et de ses compétences métier.',
  },
  {
    title: 'L’entreprise contrôle',
    text: 'Elle relit les questions, les réponses attendues, les explications et les niveaux de difficulté.',
  },
  {
    title: 'L’entreprise décide',
    text: 'Elle corrige ce qui doit l’être puis active uniquement la version qu’elle juge adaptée.',
  },
] as const;

export function CompanyQuestionnaireCreation() {
  return (
    <section
      id="construction-evaluation"
      className="scroll-mt-28 rounded-[34px] border border-seveno-border-default bg-seveno-surface-section p-6 shadow-2xl sm:p-8 lg:p-10"
    >
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-10 xl:gap-14">
        <div className="lg:col-span-5">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">CONSTRUIRE ET VALIDER</p>
          <h2 className="mt-4 text-[2rem] leading-[1.12] font-semibold tracking-tight text-seveno-text-primary sm:text-[2.375rem] lg:text-[2.75rem]">
            <span className="text-seveno-brand-cyan">Gagnez</span> du <span className="text-seveno-brand-cyan">temps</span> avec une première <span className="text-seveno-brand-cyan">proposition</span>, sans perdre le <span className="text-seveno-brand-cyan">contrôle</span>.
          </h2>
        </div>
        <div className="space-y-4 text-base leading-7 text-seveno-text-secondary sm:text-lg sm:leading-8 lg:col-span-7 lg:pt-9">
          <p>
            À partir des compétences, des missions et du contexte de l’offre, Seven’O peut préparer une première version du questionnaire métier.
          </p>
          <p>
            L’entreprise n’a plus à construire seule les 20 questions : elle relit la proposition, corrige ce qui doit l’être et décide de son activation.
          </p>
        </div>
      </div>

      <div className="mt-9 grid gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(17rem,1fr)] lg:items-stretch">
        <article className="relative overflow-hidden rounded-[30px] border border-seveno-brand-cyan/35 bg-gradient-to-br from-seveno-surface-active to-seveno-surface-panel p-5 shadow-xl sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-seveno-brand-cyan">MODE ASSISTÉ</p>
            <span className="rounded-full border border-seveno-brand-blue/35 bg-seveno-surface-active px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-seveno-brand-cyan-soft">
              RECOMMANDÉ
            </span>
          </div>

          <h3 className="mt-5 max-w-2xl text-2xl font-semibold leading-8 tracking-tight text-seveno-text-primary">
            Partez d’une première version déjà structurée.
          </h3>
          <div className="mt-5 max-w-3xl space-y-3 text-base leading-7 text-seveno-text-secondary">
            <p>Seven’O prépare une proposition de questionnaire directement liée au besoin réel du poste.</p>
            <p>
              L’entreprise contrôle ensuite chaque question, les réponses proposées, la réponse attendue, l’explication et le niveau de difficulté.
            </p>
            <p>Elle peut modifier, compléter, réorganiser ou supprimer tout élément avant l’activation.</p>
          </div>

          <div className="relative mt-7 border-y border-seveno-border-subtle py-6">
            <div aria-hidden="true" className="absolute top-11 right-[16.666%] left-[16.666%] hidden h-px bg-seveno-brand-blue/25 md:block" />
            <ol className="relative grid gap-4 md:grid-cols-3">
              {assistedSteps.map((step, index) => (
                <li key={step.title} className="relative flex gap-3 md:flex-col">
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-seveno-brand-cyan/35 bg-seveno-surface-elevated text-sm font-semibold text-seveno-brand-cyan-soft">
                    {index + 1}
                  </span>
                  <div>
                    <h4 className="text-base font-semibold leading-6 text-seveno-text-primary">{step.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-seveno-text-secondary">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <p className="mt-6 rounded-[20px] border border-seveno-brand-blue/25 bg-seveno-surface-active px-5 py-4 text-base font-semibold leading-7 text-seveno-brand-cyan-soft">
            Un gain de temps important dans la préparation, tout en conservant une validation humaine complète.
          </p>
        </article>

        <article className="flex h-full flex-col rounded-[28px] border border-seveno-border-default bg-seveno-surface-panel p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-seveno-text-muted">MODE MANUEL</p>
          <h3 className="mt-5 text-2xl font-semibold leading-8 tracking-tight text-seveno-text-primary">
            Construisez entièrement votre questionnaire.
          </h3>
          <div className="mt-5 space-y-4 text-base leading-7 text-seveno-text-secondary">
            <p>
              L’entreprise peut également partir d’une page blanche et rédiger elle-même les questions, les réponses attendues, les explications et les niveaux de difficulté.
            </p>
            <p>
              Ce mode reste disponible pour les besoins très spécifiques ou lorsqu’un questionnaire existe déjà en interne.
            </p>
          </div>
        </article>
      </div>

      <div className="mt-6 rounded-[24px] border border-seveno-border-default bg-seveno-surface-panel px-5 py-5 text-center sm:px-8 sm:py-6">
        <p className="text-base font-semibold leading-7 text-seveno-text-primary sm:text-lg sm:leading-8">
          Seven’O prépare une première base. L’entreprise vérifie, corrige et décide de ce qui sera réellement proposé aux candidats.
        </p>
        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-seveno-brand-cyan">Aucune question n’est activée automatiquement.</p>
      </div>
    </section>
  );
}
