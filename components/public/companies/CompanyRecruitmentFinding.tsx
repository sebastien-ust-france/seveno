const recruitmentSteps = [
  {
    number: '1',
    title: 'Le CV laisse supposer',
    text: 'Un intitulé de poste, un diplôme ou plusieurs années d’expérience peuvent indiquer qu’une personne connaît un métier. Ils ne démontrent pas nécessairement comment elle réagira face aux besoins précis de la nouvelle entreprise.',
  },
  {
    number: '2',
    title: 'L’entretien permet de convaincre',
    text: 'Le candidat explique son parcours, présente ses expériences et décrit sa manière de travailler. Cet échange est essentiel, mais il repose largement sur des déclarations et sur l’interprétation du recruteur.',
  },
  {
    number: '3',
    title: 'La période d’essai révèle',
    text: 'Les compétences sont réellement confrontées au travail quotidien après l’embauche. Lorsqu’une inadéquation apparaît, l’entreprise a déjà recruté, intégré, parfois formé la personne et mobilisé ses équipes.',
  },
] as const;

export function CompanyRecruitmentFinding() {
  return (
    <section
      id="constat-recrutement"
      className="scroll-mt-28 p-6 sm:p-8 lg:p-10"
    >
      <div className="max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">CE QUI SE PASSE AUJOURD’HUI</p>
        <h2 className="mt-4 text-[2rem] leading-[1.12] font-semibold tracking-tight text-seveno-text-primary sm:text-[2.375rem] lg:text-[2.75rem]">
          Le <span className="text-seveno-brand-cyan">parcours</span> passé est souvent <span className="text-seveno-brand-cyan">évalué</span> avant le <span className="text-seveno-brand-cyan">poste</span> à venir.
        </h2>
        <p className="mt-5 max-w-3xl text-base leading-7 text-seveno-text-secondary sm:text-lg sm:leading-8">
          Le CV et l’entretien restent utiles pour comprendre une personne. Mais ils conduisent souvent l’entreprise à déduire ses compétences à partir de son parcours, sans les confronter directement aux besoins précis du futur poste.
        </p>
      </div>

      <div className="relative mt-8">
        <div aria-hidden="true" className="absolute top-7 right-[16.666%] left-[16.666%] hidden h-px bg-seveno-brand-blue/25 xl:block" />
        <ol className="relative grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recruitmentSteps.map((step, index) => (
            <li key={step.number} className={index === 2 ? 'md:col-span-2 xl:col-span-1' : ''}>
              <article className="flex h-full flex-col rounded-[26px] border border-seveno-border-subtle bg-seveno-surface-panel p-5 sm:p-6">
                <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-seveno-brand-cyan/30 bg-seveno-surface-elevated text-lg font-semibold text-seveno-brand-cyan-soft">
                  {step.number}
                </span>
                <h3 className="mt-5 text-xl font-semibold leading-7 text-seveno-text-primary">{step.title}</h3>
                <p className="mt-3 text-base leading-7 text-seveno-text-secondary">{step.text}</p>
              </article>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-6 rounded-[22px] border border-seveno-brand-blue/40 bg-seveno-surface-active px-5 py-4 text-center text-base font-semibold leading-7 text-seveno-text-primary sm:px-6 sm:text-lg sm:leading-8">
        La période d’essai ne devrait pas devenir la première véritable évaluation métier.
      </p>
    </section>
  );
}
