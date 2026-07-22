import { CompanySection } from '@/components/public/companies/CompanySection';

const questionnaireBlocks = [
  {
    eyebrow: 'Le questionnaire d’aptitudes générales Seven’O',
    body:
      'Il apporte une lecture commune de la manière dont le candidat comprend l’information, s’organise, résout des problèmes, agit avec autonomie, s’adapte, collabore et travaille avec rigueur.',
    footer:
      'Il enrichit le profil. Il ne produit ni score d’employabilité ni décision automatique de recrutement.',
    accent:
      'border-cyan-400/15 bg-[linear-gradient(180deg,rgba(10,17,32,0.98),rgba(8,15,28,0.95))]',
    eyebrowClassName: 'text-cyan-200/90',
    footerClassName: 'text-cyan-100',
  },
  {
    eyebrow: 'Le questionnaire propre à l’offre',
    body:
      'Il évalue les connaissances, les choix et les situations directement liés au poste proposé. Son contenu, ses réponses attendues et son seuil de réussite sont définis par l’entreprise.',
    footer:
      'Il sert à qualifier une candidature pour une offre précise, pas à juger la valeur générale d’un professionnel.',
    accent:
      'border-violet-400/15 bg-[linear-gradient(180deg,rgba(13,14,34,0.98),rgba(8,15,28,0.95))]',
    eyebrowClassName: 'text-violet-200/90',
    footerClassName: 'text-violet-100',
  },
] as const;

export function CompanyQuestionnaireDifference() {
  return (
    <CompanySection
      id="questionnaires-seveno"
      eyebrow="DEUX QUESTIONNAIRES, DEUX RÔLES"
      title="Un socle commun pour comprendre le profil. Un questionnaire ciblé pour évaluer le poste."
      description="Le questionnaire Seven’O et le questionnaire entreprise ne mesurent pas la même chose. Ils se complètent sans se remplacer."
    >
      <div className="grid gap-4 xl:grid-cols-2 xl:items-stretch">
        {questionnaireBlocks.map((block) => (
          <article
            key={block.eyebrow}
            className={`flex h-full rounded-[28px] border p-5 shadow-[0_18px_60px_rgba(2,6,23,0.18)] sm:p-6 ${block.accent}`}
          >
            <div className="flex h-full flex-col gap-4">
              <p className={`text-sm font-semibold uppercase tracking-[0.24em] ${block.eyebrowClassName}`}>{block.eyebrow}</p>
              <p className="max-w-2xl text-base leading-8 text-slate-200">{block.body}</p>
              <p className={`mt-auto max-w-2xl text-base font-semibold leading-8 ${block.footerClassName}`}>
                {block.footer}
              </p>
            </div>
          </article>
        ))}
      </div>
    </CompanySection>
  );
}
