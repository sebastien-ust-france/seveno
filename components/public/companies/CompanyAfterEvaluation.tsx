const afterEvaluationSteps = [
  {
    number: '01',
    title: 'Ouvrir la conversation',
    text: 'Après avoir consulté les résultats, l’entreprise peut choisir de poursuivre avec le candidat et d’ouvrir un échange dans la messagerie intégrée.',
    complement: 'Le score apporte un repère. La décision d’engager la discussion reste humaine.',
  },
  {
    number: '02',
    title: 'Approfondir certains points',
    text: 'L’entreprise peut revenir sur certaines réponses, demander des précisions et mieux comprendre le raisonnement du candidat.',
    complement: 'L’échange permet d’apporter du contexte là où un questionnaire ne peut pas, à lui seul, restituer toute la réflexion d’une personne.',
  },
  {
    number: '03',
    title: 'Présenter la réalité du poste',
    text: 'La conversation permet de préciser les missions, les attentes, l’organisation du travail et les conditions de la future collaboration.',
    complement: 'Le candidat dispose ainsi d’informations plus concrètes pour déterminer si l’opportunité correspond réellement à ses attentes.',
  },
  {
    number: '04',
    title: 'Vérifier l’intérêt des deux parties',
    text: 'L’entreprise peut apprécier l’implication, la compréhension et l’intérêt du candidat pour le poste.',
    complement: 'De son côté, le candidat peut également décider s’il souhaite poursuivre avec l’entreprise.',
  },
  {
    number: '05',
    title: 'Décider de se dévoiler',
    text: 'Lorsque les échanges sont concluants, chaque partie peut accepter de lever l’anonymat et de poursuivre le recrutement avec les informations nécessaires.',
    complement: 'Ni l’entreprise ni le candidat ne peut imposer seul cette levée de l’anonymat.',
  },
] as const;

const stepLayoutClasses = [
  'xl:col-span-3 xl:col-start-1 xl:row-span-3 xl:row-start-1',
  'xl:col-span-6 xl:col-start-4 xl:row-start-1',
  'xl:col-span-6 xl:col-start-4 xl:row-start-2',
  'xl:col-span-6 xl:col-start-4 xl:row-start-3',
  'xl:col-span-3 xl:col-start-10 xl:row-span-3 xl:row-start-1',
] as const;

function DoubleAgreement() {
  return (
    <div className="mt-6 border-t border-seveno-border-subtle pt-5">
      <div className="grid grid-cols-2 gap-2 text-center text-xs font-semibold text-seveno-text-secondary">
        <span className="rounded-full border border-seveno-company/30 bg-seveno-surface-active px-2 py-2">Accord entreprise</span>
        <span className="rounded-full border border-seveno-candidate/30 bg-seveno-surface-active px-2 py-2">Accord candidat</span>
      </div>
      <div aria-hidden="true" className="mx-auto h-5 w-px bg-seveno-brand-warm/35" />
      <p className="mx-auto w-fit rounded-full border border-seveno-reciprocal-agreement/45 bg-seveno-surface-elevated px-3 py-2 text-center text-xs font-semibold text-seveno-brand-warm">
        Accord réciproque
      </p>
      <div aria-hidden="true" className="mx-auto h-5 w-px bg-seveno-brand-warm/35" />
      <p className="rounded-[16px] border border-seveno-identity-reveal/40 bg-seveno-surface-active px-3 py-3 text-center text-sm font-semibold text-seveno-brand-warm">
        Identités dévoilées
      </p>
    </div>
  );
}

export function CompanyAfterEvaluation() {
  return (
    <section
      id="apres-evaluation"
      className="scroll-mt-28 rounded-[34px] border border-seveno-border-default bg-seveno-surface-section p-6 shadow-2xl sm:p-8 lg:p-10"
    >
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-10 xl:gap-14">
        <div className="lg:col-span-5">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-conversation">APRÈS L’ÉVALUATION</p>
          <h2 className="mt-4 text-[2rem] leading-[1.12] font-semibold tracking-tight text-seveno-text-primary sm:text-[2.375rem] lg:text-[2.75rem]">
            <span className="text-seveno-brand-cyan">Échangez</span> avant de <span className="text-seveno-identity-reveal">dévoiler</span> les <span className="text-seveno-identity-reveal">identités</span>.
          </h2>
        </div>
        <div className="space-y-4 text-base leading-7 text-seveno-text-secondary sm:text-lg sm:leading-8 lg:col-span-7 lg:pt-9">
          <p>
            Les résultats du questionnaire apportent un premier éclairage sur l’adéquation avec le poste. Ils ne remplacent pas la discussion nécessaire entre l’entreprise et le candidat.
          </p>
          <p>
            Lorsque l’entreprise souhaite poursuivre, une conversation peut commencer directement dans la messagerie Seven’O, tandis que les deux parties restent encore anonymes.
          </p>
        </div>
      </div>

      <div className="relative mt-10">
        <div aria-hidden="true" className="absolute top-7 bottom-7 left-6 w-px bg-seveno-conversation/20 xl:hidden" />
        <div aria-hidden="true" className="absolute top-0 bottom-0 left-1/4 right-1/4 hidden rounded-[30px] border border-seveno-conversation/15 bg-seveno-surface-active xl:block" />
        <div aria-hidden="true" className="absolute top-1/2 right-[23%] left-[23%] hidden h-px bg-gradient-to-r from-seveno-company/25 via-seveno-candidate/25 to-seveno-brand-warm/25 xl:block" />

        <ol className="relative grid gap-4 xl:grid-cols-12 xl:grid-rows-3 xl:gap-5">
          {afterEvaluationSteps.map((step, index) => {
            const isConversationStep = index >= 1 && index <= 3;
            const isFinalStep = index === 4;

            return (
              <li key={step.number} className={stepLayoutClasses[index]}>
                <article
                  className={`relative z-10 flex h-full flex-col rounded-[26px] border p-5 sm:p-6 ${
                    isConversationStep
                      ? 'border-seveno-conversation/25 bg-seveno-surface-panel xl:grid xl:grid-cols-[auto_1fr] xl:gap-x-5'
                      : isFinalStep
                        ? 'border-seveno-brand-warm/30 bg-seveno-surface-elevated'
                        : 'border-seveno-border-subtle bg-seveno-surface-panel'
                  }`}
                >
                  <div className={isConversationStep ? 'xl:row-span-3' : ''}>
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-full border text-sm font-semibold ${
                        isFinalStep
                          ? 'border-seveno-brand-warm/40 bg-seveno-surface-active text-seveno-brand-warm'
                          : 'border-seveno-conversation/30 bg-seveno-surface-active text-seveno-brand-cyan-soft'
                      }`}
                    >
                      {step.number}
                    </span>
                  </div>
                  <div>
                    {index === 1 ? (
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-seveno-conversation">ÉCHANGES ANONYMES</p>
                    ) : null}
                    <h3 className="mt-4 text-xl font-semibold leading-7 text-seveno-text-primary xl:mt-0">{step.title}</h3>
                    <p className="mt-3 text-base leading-7 text-seveno-text-secondary">{step.text}</p>
                    {isFinalStep ? (
                      <p className="mt-4 border-l-2 border-seveno-brand-warm/45 pl-4 text-base font-semibold leading-7 text-seveno-brand-warm">
                        L’identité et les coordonnées ne sont dévoilées qu’après l’accord des deux parties.
                      </p>
                    ) : null}
                    <p className="mt-3 text-sm leading-6 text-seveno-text-muted">{step.complement}</p>
                  </div>
                  {isFinalStep ? <DoubleAgreement /> : null}
                </article>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-7 rounded-[24px] border border-seveno-border-default bg-seveno-surface-panel px-5 py-5 text-center sm:px-8 sm:py-6">
        <p className="text-base font-semibold leading-7 text-seveno-text-primary sm:text-lg sm:leading-8">
          L’évaluation permet d’ouvrir une conversation pertinente. La conversation permet de décider s’il est utile d’aller plus loin.
        </p>
        <p className="mt-3 text-sm leading-6 text-seveno-text-secondary sm:text-base sm:leading-7">
          Seven’O organise une progression : évaluation métier, échanges anonymes, intérêt réciproque, double accord puis levée de l’anonymat.
        </p>
      </div>
    </section>
  );
}
