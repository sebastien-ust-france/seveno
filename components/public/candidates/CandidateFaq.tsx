const faqItems = [
  {
    question: 'Seven’O est-il payant pour les candidats ?',
    answer:
      'Non. Seven’O est gratuit pour les candidats. Aucun paiement n’est demandé pour créer, compléter ou maintenir son profil professionnel.',
  },
  {
    question: 'Dois-je être disponible immédiatement pour créer mon profil ?',
    answer:
      'Non. Vous pouvez préparer votre profil aujourd’hui, que vous soyez disponible maintenant, dans un mois, dans trois mois ou à une autre échéance.',
  },
  {
    question: 'Mon profil est-il visible avec mon identité ?',
    answer:
      'Non. Votre profil professionnel est présenté sans votre nom, votre email, votre téléphone, votre photo ni votre adresse précise.',
  },
  {
    question: 'Le questionnaire Seven’O est-il un examen éliminatoire ?',
    answer:
      'Non. Il enrichit la lecture de votre profil et ne produit pas de décision automatique de recrutement ou d’exclusion.',
  },
  {
    question: 'Les recommandations sont-elles obligatoires ?',
    answer: 'Non. Elles sont facultatives et ne bloquent jamais votre profil.',
  },
  {
    question: 'Puis-je avoir plusieurs recommandations ?',
    answer:
      'Oui. Chaque recommandation est indépendante et peut provenir d’un ancien employeur, d’un responsable ou d’un partenaire professionnel.',
  },
  {
    question: 'Puis-je modifier mon profil après sa création ?',
    answer:
      'Oui. Votre recherche, votre présentation et votre disponibilité peuvent être mises à jour afin de rester cohérentes avec votre situation.',
  },
  {
    question: 'Comment se déroule une candidature ?',
    answer:
      'Vous confirmez les prérequis du poste puis vous répondez, lorsqu’il existe, au questionnaire ciblé de l’entreprise. L’entreprise étudie ensuite votre candidature.',
  },
  {
    question: 'Quand mes coordonnées sont-elles révélées ?',
    answer:
      'Elles restent privées pendant les premières étapes et sont révélées selon le processus de validation mutuelle prévu par Seven’O.',
  },
  {
    question: 'Comment exercer mes droits ou demander la suppression de mon compte ?',
    answer:
      'Vous pouvez contacter Seven’O à l’adresse contact@ust-france.com afin d’exercer vos droits ou de demander la suppression de votre compte et de vos données.',
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
      <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-5 text-left text-base font-semibold leading-7 text-seveno-text-primary transition hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus focus-visible:ring-offset-0 [&::-webkit-details-marker]:hidden sm:text-[17px]">
        <span className="min-w-0 flex-1">{question}</span>
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm leading-none text-seveno-text-secondary transition-transform duration-200 group-open:rotate-180 group-open:border-seveno-brand-cyan/30 group-open:bg-seveno-brand-cyan/10 group-open:text-cyan-100"
        >
          ⌄
        </span>
      </summary>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-seveno-text-secondary sm:text-[15px]">
        {answer}
      </p>
    </details>
  );
}

export function CandidateFaq() {
  const leftColumnItems = faqItems.slice(0, 5);
  const rightColumnItems = faqItems.slice(5, 10);

  return (
    <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.95),rgba(8,15,28,0.9))] px-5 py-8 shadow-[0_20px_70px_rgba(2,6,23,0.24)] sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <div className="mx-auto w-full max-w-[1340px]">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">FAQ CANDIDAT</p>
        <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-seveno-text-primary sm:text-3xl lg:text-[2rem]">
          Les réponses aux questions les plus fréquentes.
        </h2>

        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-0 lg:grid-cols-2">
          <div className="lg:pr-4 lg:border-r lg:border-white/10">
            {leftColumnItems.map((item) => (
              <FaqItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
          <div className="lg:pl-4">
            {rightColumnItems.map((item) => (
              <FaqItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
