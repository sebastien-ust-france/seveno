const leftColumnFaqItems = [
  {
    question: "Qu’est-ce que Seven’O ?",
    answer:
      "Seven’O est une plateforme de recrutement et un observatoire des talents. Elle prépare la rencontre entre les professionnels et les entreprises à partir de besoins précis, de profils professionnels, de disponibilités réelles et d’un intérêt mutuel.",
  },
  {
    question: "Que peuvent faire les candidats sur Seven’O ?",
    answer:
      "Les candidats peuvent créer leur compte, préciser leur recherche et leur disponibilité, présenter leur parcours, compléter le questionnaire d’aptitudes générales Seven’O et demander plusieurs recommandations professionnelles.",
  },
  {
    question: "Dois-je être disponible immédiatement pour créer mon profil ?",
    answer:
      "Non. Vous pouvez préparer votre profil aujourd’hui, que vous soyez disponible immédiatement, dans un mois, dans trois mois ou à une autre échéance correspondant à votre situation.",
  },
  {
    question: "Mon identité est-elle visible dès le début ?",
    answer:
      "Non. Le candidat est d’abord présenté à travers son profil professionnel et l’entreprise à travers le poste, les missions et les conditions proposées. Les identités prennent place après la confirmation d’un intérêt mutuel.",
  },
  {
    question: "Les recommandations professionnelles sont-elles obligatoires ?",
    answer:
      "Non. Elles sont facultatives et ne bloquent jamais le profil. Un candidat peut toutefois en demander plusieurs à d’anciens employeurs, responsables ou partenaires professionnels. Le recommandant n’a pas besoin de créer un compte Seven’O.",
  },
] as const;

const rightColumnFaqItems = [
  {
    question: "Puis-je modifier mon profil et ma disponibilité ?",
    answer:
      "Oui. Votre recherche, votre présentation et votre disponibilité peuvent évoluer. Il est important de maintenir votre profil à jour afin qu’il corresponde à votre situation réelle.",
  },
  {
    question: "Comment une entreprise peut-elle rejoindre Seven’O ?",
    answer:
      "L’accès entreprise est ouvert progressivement. Les entreprises intéressées doivent contacter Seven’O depuis la rubrique Contact afin d’obtenir un accès de lancement et de bénéficier de conditions préférentielles pendant cette phase.",
  },
  {
    question: "La mise en relation est-elle déjà opérationnelle ?",
    answer:
      "Oui. Elle fonctionne pour les entreprises disposant d’un accès de lancement. L’entreprise peut définir son besoin, utiliser ses prérequis et son questionnaire, étudier les candidatures puis engager la conversation après validation mutuelle.",
  },
  {
    question: "Seven’O remplace-t-il le recruteur ?",
    answer:
      "Non. Seven’O aide à mieux définir les besoins, comprendre les profils et préparer la rencontre. La décision reste humaine, aussi bien du côté de l’entreprise que du candidat.",
  },
  {
    question: "À quoi sert l’observatoire Seven’O ?",
    answer:
      "L’observatoire recueille les retours des professionnels et des entreprises pour mieux comprendre les difficultés du marché, les compétences disponibles et les attentes liées au recrutement. Les réponses à l’étude restent distinctes des profils et des recrutements réalisés sur Seven’O.",
  },
] as const;

function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  return (
    <details className="group border-b border-white/10 py-4 last:border-b-0 sm:py-5">
      <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-5 text-left text-base font-semibold leading-7 text-white transition hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40 focus-visible:ring-offset-0 [&::-webkit-details-marker]:hidden sm:text-[17px]">
        <span className="min-w-0 flex-1">{question}</span>
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm leading-none text-slate-300 transition-transform duration-200 group-open:rotate-180 group-open:border-cyan-300/20 group-open:text-cyan-100"
        >
          ⌄
        </span>
      </summary>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
        {answer}
      </p>
    </details>
  );
}

export function HomeFaqSection() {
  return (
    <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.95),rgba(8,15,28,0.9))] px-5 py-8 shadow-[0_20px_70px_rgba(2,6,23,0.24)] sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <div className="mx-auto w-full max-w-[1340px]">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">QUESTIONS FRÉQUENTES</p>
        <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-[2rem]">
          Ce qu’il faut savoir avant de rejoindre Seven’O
        </h2>

        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-0 lg:grid-cols-2">
          <div className="lg:pr-4 lg:border-r lg:border-white/10">
            {leftColumnFaqItems.map((item) => (
              <FaqItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
          <div className="lg:pl-4">
            {rightColumnFaqItems.map((item) => (
              <FaqItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
