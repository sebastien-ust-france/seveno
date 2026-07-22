const contactFaqItems = [
  {
    question: 'Comment demander un accès entreprise ?',
    answer:
      'Sélectionnez « Demande d’accès entreprise » dans le formulaire et précisez le nom de votre organisation, son activité et le besoin de recrutement envisagé.',
  },
  {
    question: 'Je rencontre un problème avec mon compte candidat. Que dois-je indiquer ?',
    answer:
      'Précisez l’adresse utilisée pour la connexion, la page concernée, l’action réalisée et le message d’erreur affiché. Ne transmettez jamais votre mot de passe.',
  },
  {
    question: 'Mon lien de recommandation ne fonctionne plus. Que faire ?',
    answer:
      'Indiquez si le lien est expiré, révoqué ou déjà utilisé ainsi que l’adresse email ayant reçu l’invitation. Ne publiez pas le lien sécurisé dans un espace public.',
  },
  {
    question: 'Comment demander la suppression de mon compte ou exercer mes droits ?',
    answer:
      'Sélectionnez « Données personnelles et suppression ». Seven’O pourra demander les informations strictement nécessaires pour vérifier votre identité avant de traiter la demande.',
  },
  {
    question: 'Comment signaler une offre, un message ou un comportement ?',
    answer:
      'Sélectionnez « Signaler un problème ou un comportement » et décrivez précisément l’élément concerné, sans diffuser publiquement les données d’une autre personne.',
  },
  {
    question: 'Puis-je transmettre un retour sur l’étude ou l’Observatoire ?',
    answer:
      'Oui. Sélectionnez « Étude ou Observatoire » et précisez si votre message concerne le questionnaire public, un enseignement publié ou une proposition d’amélioration.',
  },
] as const;

function ContactFaqItem({ question, answer }: { question: string; answer: string }) {
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
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">{answer}</p>
    </details>
  );
}

export function ContactFaq() {
  const leftItems = contactFaqItems.slice(0, 3);
  const rightItems = contactFaqItems.slice(3, 6);

  return (
    <section className="rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.96),rgba(8,15,28,0.9))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.24)] sm:p-8 lg:p-10">
      <div className="mx-auto w-full max-w-[1340px]">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">QUESTIONS FRÉQUENTES</p>
        <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-[2rem]">
          Avant de contacter Seven’O
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          Certaines réponses peuvent résoudre votre demande immédiatement.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-0 lg:grid-cols-2">
          <div className="lg:pr-4 lg:border-r lg:border-white/10">
            {leftItems.map((item) => (
              <ContactFaqItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
          <div className="lg:pl-4">
            {rightItems.map((item) => (
              <ContactFaqItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
