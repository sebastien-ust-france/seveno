const findings = [
  {
    kicker: 'RÉPONSES ET SUIVI',
    title: 'Le silence abîme la relation.',
    text: 'Les candidats ne dénoncent pas seulement le refus. Ils dénoncent surtout l’absence de réponse, le manque de suivi et l’impossibilité de savoir si leur candidature a réellement été étudiée.',
  },
  {
    kicker: 'TEMPS ET TRANSPARENCE',
    title: 'Les processus sont trop longs et trop opaques.',
    text: 'Entre l’envoi d’une candidature et une éventuelle réponse, les étapes restent souvent difficiles à comprendre. Cette attente prolongée fait perdre du temps aux candidats comme aux recruteurs.',
  },
  {
    kicker: 'PROFILS ET COMPÉTENCES',
    title: 'Le CV ne suffit plus à comprendre un professionnel.',
    text: 'Un intitulé de poste, un secteur ou quelques mots-clés ne permettent pas toujours d’identifier les compétences transférables, la motivation ou la capacité à réussir dans un nouvel environnement.',
  },
  {
    kicker: 'LE BON MOMENT',
    title: 'La disponibilité change la valeur d’un profil.',
    text: 'Un professionnel pertinent mais indisponible ne répond pas au même besoin qu’un profil prêt à avancer aujourd’hui, dans un mois ou dans trois mois. Le bon recrutement dépend aussi du bon moment.',
  },
  {
    kicker: 'CONFIANCE',
    title: 'Les candidats attendent des offres réelles.',
    text: 'La publication d’offres anciennes, déjà pourvues ou utilisées uniquement pour constituer un vivier entretient la défiance. Les professionnels veulent savoir qu’un besoin existe réellement et qu’une réponse leur sera apportée.',
  },
  {
    kicker: 'BESOINS ET CRITÈRES',
    title: 'Les entreprises ont besoin de critères plus précis.',
    text: 'Le volume de candidatures ne garantit pas leur pertinence. Les recruteurs ont besoin de mieux définir le poste, les prérequis, les conditions et les compétences réellement attendues avant de chercher des profils.',
  },
] as const;

export function ObservatoryFindings() {
  const leftFindings = findings.filter((_, index) => index % 2 === 0);
  const rightFindings = findings.filter((_, index) => index % 2 === 1);

  function renderFinding(finding: (typeof findings)[number], originalIndex: number) {
    const number = String(originalIndex + 1).padStart(2, '0');
    const accentClass =
      originalIndex % 3 === 0 ? 'text-cyan-200/70' : originalIndex % 3 === 1 ? 'text-violet-200/70' : 'text-orange-200/70';

    return (
      <article key={finding.title} className="border-t border-white/10 pt-5 sm:pt-6">
        <div className="flex items-start gap-4 sm:gap-5">
          <p className={`shrink-0 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl lg:text-6xl ${accentClass}`}>
            {number}
          </p>
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/85">{finding.kicker}</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-[2rem]">
              {finding.title}
            </h2>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">{finding.text}</p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-x-14">
        <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10">
          {leftFindings.map((finding, index) => renderFinding(finding, index * 2))}
        </div>

        <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10 lg:pt-16 xl:pt-20">
          {rightFindings.map((finding, index) => renderFinding(finding, index * 2 + 1))}
        </div>
      </div>
    </section>
  );
}
