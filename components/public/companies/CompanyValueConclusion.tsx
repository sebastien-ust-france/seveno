const benefits = [
  {
    number: '01',
    title: 'Plus de pertinence',
    text: 'La sélection repose davantage sur l’adéquation avec le poste que sur la seule ressemblance entre un parcours passé et un profil théorique.',
  },
  {
    number: '02',
    title: 'Un gain de temps',
    text: 'L’entreprise concentre ses échanges sur des candidats déjà évalués face aux besoins du poste, plutôt que de multiplier les entretiens sans élément métier préalable.',
  },
  {
    number: '03',
    title: 'Plus d’efficacité',
    text: 'Les résultats donnent une base concrète à la conversation. L’entreprise sait quels points confirmer, quelles réponses approfondir et quelles attentes préciser.',
  },
  {
    number: '04',
    title: 'Une meilleure maîtrise du risque financier',
    text: 'Évaluer plus tôt ne garantit pas la réussite d’un recrutement. Cela permet toutefois d’agir avant que l’entreprise engage davantage de temps et de moyens sur une adéquation insuffisamment vérifiée.',
  },
] as const;

export function CompanyValueConclusion() {
  return (
    <section
      id="valeur-seveno"
      className="scroll-mt-28 overflow-hidden rounded-[34px] border border-seveno-brand-blue/25 bg-gradient-to-br from-seveno-surface-section via-seveno-surface-panel to-seveno-surface-page p-6 shadow-2xl sm:p-8 lg:p-10"
    >
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-x-12 lg:gap-y-7">
        <header className="lg:col-span-7">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">CE QUE SEVEN’O CHANGE</p>
          <h2 className="mt-4 text-[2rem] leading-[1.12] font-semibold tracking-tight text-seveno-text-primary sm:text-[2.375rem] lg:text-[2.7rem]">
            Un CV laisse <span className="text-seveno-brand-cyan">supposer</span> des compétences. Le <span className="text-seveno-brand-cyan">questionnaire Seven’O</span> les <span className="text-seveno-brand-cyan">confronte</span> aux réalités du <span className="text-seveno-brand-cyan">poste</span>.
          </h2>
        </header>

        <aside className="lg:col-span-5 lg:row-span-2" aria-label="Contexte du recrutement des cadres">
          <div className="h-full border-l border-seveno-brand-cyan/30 pl-5 sm:pl-7 lg:pt-1">
            <p className="bg-gradient-to-r from-seveno-brand-cyan to-seveno-brand-blue bg-clip-text text-6xl font-semibold tracking-[-0.06em] text-transparent sm:text-7xl">75 %</p>
            <p className="mt-5 text-base leading-7 text-seveno-text-secondary sm:text-lg sm:leading-8">
              En 2025, la moitié des entreprises ayant recruté au moins un cadre ont rencontré des difficultés pour mener leurs recrutements à bien. Parmi elles, 75 % évoquent un décalage entre les candidatures reçues et les profils recherchés.
            </p>
            <a
              href="https://corporate.apec.fr/home/nos-etudes/toutes-nos-etudes/pratiques-de-recrutement-de-cadres-2026.html"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex rounded-sm text-sm leading-6 text-seveno-text-muted underline decoration-seveno-border-strong underline-offset-4 transition-colors hover:text-seveno-text-link focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-seveno-border-focus"
            >
              Source : Apec, Pratiques de recrutement de cadres 2026.
            </a>
          </div>
        </aside>

        <div className="space-y-4 text-base leading-7 text-seveno-text-secondary sm:text-lg sm:leading-8 lg:col-span-7">
          <p>Mais ce décalage signifie-t-il réellement que les compétences recherchées sont absentes du marché ?</p>
          <p>
            Ou révèle-t-il aussi les limites d’une méthode qui tente encore de les repérer principalement à travers un CV, des intitulés de poste, des diplômes, un nombre d’années d’expérience ou des mots-clés ?
          </p>
        </div>
      </div>

      <div className="relative mt-12 grid gap-6 lg:grid-cols-2 lg:gap-12">
        <div aria-hidden="true" className="absolute top-5 bottom-5 left-1/2 hidden w-px bg-gradient-to-b from-transparent via-seveno-border-default to-transparent lg:block" />
        <article className="border-t border-seveno-brand-blue/25 pt-6 lg:pr-6">
          <h3 className="text-2xl font-semibold leading-8 text-seveno-text-primary">
            Continuer à filtrer des parcours, ou commencer à évaluer ce que le poste exige réellement ?
          </h3>
          <div className="mt-5 space-y-4 text-base leading-7 text-seveno-text-secondary">
            <p>
              Les ATS permettent d’organiser, de filtrer et de traiter un volume important de candidatures. L’intelligence artificielle peut également aider à rédiger, résumer ou rapprocher certains critères.
            </p>
            <p>Mais filtrer plus rapidement les mêmes informations ne suffit pas nécessairement à rendre la sélection plus pertinente.</p>
            <p>
              Un outil peut repérer des mots, des intitulés, des diplômes ou des expériences. Il ne peut pas, à lui seul, remplacer ce qu’une évaluation liée au poste et un échange humain permettent de comprendre.
            </p>
          </div>
        </article>

        <article className="border-t border-seveno-brand-cyan/30 pt-6 lg:pl-6">
          <h3 className="text-2xl font-semibold leading-8 text-seveno-brand-cyan-soft">Seven’O utilise la technologie autrement.</h3>
          <div className="mt-5 space-y-4 text-base leading-7 text-seveno-text-secondary">
            <p>
              Seven’O ne demande pas à la technologie de choisir un candidat à la place de l’entreprise. Il l’utilise pour préparer une évaluation directement liée au poste.
            </p>
            <p>
              L’entreprise dispose ainsi d’éléments concrets pour approfondir les bons sujets, apprécier la qualité des échanges et décider s’il est pertinent de poursuivre.
            </p>
          </div>
          <p className="mt-6 border-l-2 border-seveno-brand-warm/50 pl-4 text-base font-semibold leading-7 text-seveno-text-primary">
            La technologie prépare l’évaluation. L’humain observe, échange et décide.
          </p>
        </article>
      </div>

      <ol className="mt-12 grid gap-x-8 gap-y-0 border-y border-seveno-border-subtle sm:grid-cols-2">
        {benefits.map((benefit) => (
          <li key={benefit.number} className="grid grid-cols-[auto_1fr] gap-4 border-b border-seveno-border-subtle py-6 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0">
            <span
              className={`pt-1 text-sm font-semibold tracking-[0.18em] ${
                benefit.number === '01' || benefit.number === '04' ? 'text-seveno-brand-cyan' : 'text-seveno-brand-blue'
              }`}
            >
              {benefit.number}
            </span>
            <div>
              <h3 className="text-lg font-semibold leading-7 text-seveno-text-primary">{benefit.title}</h3>
              <p className="mt-2 text-sm leading-6 text-seveno-text-secondary sm:text-base sm:leading-7">{benefit.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 text-center">
        <p className="mx-auto max-w-4xl text-base font-semibold leading-7 text-seveno-brand-cyan-soft sm:text-lg sm:leading-8">
          Le parcours apporte une hypothèse. L’évaluation métier apporte des éléments concrets pour la vérifier, la nuancer ou la remettre en question.
        </p>
        <div aria-hidden="true" className="mx-auto my-7 h-10 w-px bg-gradient-to-b from-seveno-brand-cyan/55 to-seveno-brand-blue/35" />
        <p className="mx-auto max-w-5xl text-xl font-semibold leading-8 text-seveno-text-primary sm:text-2xl sm:leading-9">
          Le véritable choix n’est pas entre l’humain et l’intelligence artificielle. Il est entre une technologie qui filtre principalement des parcours et une technologie qui aide l’humain à évaluer ce qui compte réellement pour le poste.
        </p>
        <div className="mx-auto mt-8 max-w-4xl border-t border-seveno-border-subtle pt-7">
          <p className="text-base leading-7 text-seveno-text-secondary sm:text-lg sm:leading-8">
            Seven’O ne remplace pas ce qu’un recruteur peut déceler. Il lui donne plus tôt les éléments nécessaires pour mieux observer, comprendre et décider.
          </p>
          <p className="mt-4 text-sm leading-6 text-seveno-text-muted sm:text-base sm:leading-7">
            L’objectif n’est pas de supprimer tout risque de recrutement, mais d’éviter que les compétences nécessaires au poste ne soient découvertes seulement après l’embauche.
          </p>
        </div>
      </div>
    </section>
  );
}
