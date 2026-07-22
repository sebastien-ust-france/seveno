import { CompanySection } from '@/components/public/companies/CompanySection';

const faqItems = [
  {
    question: 'Quelle est la différence entre le questionnaire Seven’O et le questionnaire entreprise ?',
    answer:
      'Le questionnaire Seven’O apporte une lecture générale des aptitudes professionnelles du candidat. Le questionnaire entreprise évalue les connaissances et les situations propres à une offre précise.',
  },
  {
    question: 'Puis-je créer un questionnaire différent pour chaque offre ?',
    answer:
      'Oui. Chaque offre peut disposer d’un questionnaire adapté au métier, aux missions, aux prérequis et au niveau attendu.',
  },
  {
    question: 'Puis-je créer le questionnaire entièrement manuellement ?',
    answer:
      'Oui. Vous pouvez rédiger directement les questions, les réponses proposées, les bonnes réponses et les explications.',
  },
  {
    question: 'Seven’O peut-il m’aider à générer le questionnaire avec une IA ?',
    answer:
      'Oui. Seven’O prépare un prompt structuré à partir de l’offre. Vous l’utilisez dans l’IA de votre choix, puis vous importez la proposition obtenue dans l’éditeur Seven’O.',
  },
  {
    question: 'Puis-je modifier le questionnaire proposé par l’IA ?',
    answer:
      'Oui. Chaque question, réponse proposée, bonne réponse, explication et niveau de difficulté peut être corrigé avant validation.',
  },
  {
    question: 'Puis-je définir un seuil minimum de réussite ?',
    answer: 'Oui. Le seuil peut être fixé entre 50 % et 100 %, par paliers de 5 points.',
  },
  {
    question: 'Un candidat est-il automatiquement refusé sous le seuil ?',
    answer:
      'Non. Le seuil aide à organiser la lecture des résultats. La décision de poursuivre ou non reste prise par l’entreprise.',
  },
  {
    question: 'Quelles informations sont visibles après le questionnaire ?',
    answer:
      'L’entreprise peut consulter le score, le détail des réponses correctes et incorrectes ainsi que la position du candidat par rapport au seuil défini.',
  },
  {
    question: 'Une offre doit-elle obligatoirement avoir un questionnaire ?',
    answer:
      'Non. Le questionnaire est un outil de qualification que l’entreprise associe lorsqu’elle souhaite évaluer des critères propres au poste.',
  },
  {
    question: 'Comment obtenir un accès entreprise ?',
    answer:
      'Utilisez la rubrique Contact pour demander un accès entreprise de lancement. Les premières entreprises bénéficient de conditions préférentielles pendant la phase d’ouverture progressive.',
  },
] as const;

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group border-b border-white/10 py-4 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-left text-base font-semibold leading-7 text-white transition hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40 focus-visible:ring-offset-0 [&::-webkit-details-marker]:hidden sm:text-[17px]">
        <span className="min-w-0 flex-1">{question}</span>
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm leading-none text-slate-300 transition-transform duration-200 group-open:rotate-180 group-open:border-cyan-300/20 group-open:text-cyan-100"
        >
          ˅
        </span>
      </summary>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">{answer}</p>
    </details>
  );
}

export function CompanyFaq() {
  const leftColumnItems = faqItems.slice(0, 5);
  const rightColumnItems = faqItems.slice(5, 10);

  return (
    <CompanySection eyebrow="FAQ ENTREPRISE" title="Les réponses aux questions les plus fréquentes.">
      <div className="grid grid-cols-1 gap-x-8 gap-y-0 lg:grid-cols-2">
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
    </CompanySection>
  );
}
