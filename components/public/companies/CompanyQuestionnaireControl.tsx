import { CompanySection } from '@/components/public/companies/CompanySection';

const controlItems = [
  {
    number: '1',
    title: 'Modifier la question',
    text: 'Reformulez le texte pour qu’il corresponde précisément au poste et au vocabulaire du métier.',
    accent: 'border-cyan-400/15 bg-cyan-400/8',
    numberClassName: 'bg-cyan-400/10 text-cyan-100',
  },
  {
    number: '2',
    title: 'Modifier les réponses proposées',
    text: 'Ajoutez, supprimez ou corrigez les choix proposés au candidat.',
    accent: 'border-blue-400/15 bg-blue-400/8',
    numberClassName: 'bg-blue-400/10 text-blue-100',
  },
  {
    number: '3',
    title: 'Définir les bonnes réponses',
    text: 'Choisissez une ou plusieurs réponses correctes selon la nature de la question.',
    accent: 'border-orange-400/15 bg-orange-400/8',
    numberClassName: 'bg-orange-400/10 text-orange-100',
  },
  {
    number: '4',
    title: 'Ajouter une explication',
    text: 'Précisez pourquoi une réponse est attendue et ce qu’elle permet d’évaluer.',
    accent: 'border-white/10 bg-white/5',
    numberClassName: 'bg-white/10 text-slate-100',
  },
  {
    number: '5',
    title: 'Ajuster la difficulté',
    text: 'Adaptez le niveau de la question à l’expérience réellement attendue pour le poste.',
    accent: 'border-white/10 bg-white/5',
    numberClassName: 'bg-white/10 text-slate-100',
  },
] as const;

export function CompanyQuestionnaireControl() {
  return (
    <CompanySection
      eyebrow="VOUS GARDEZ LE CONTRÔLE"
      title="Chaque question peut être vérifiée et corrigée."
      description="Une proposition générée n’est jamais considérée comme définitive. L’éditeur vous permet de reprendre le questionnaire avant de l’associer à une offre."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {controlItems.slice(0, 3).map((item) => (
          <article key={item.number} className={`flex h-full rounded-[26px] border p-5 sm:p-6 ${item.accent}`}>
            <div className="flex h-full flex-col gap-4">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-semibold ${item.numberClassName}`}
              >
                {item.number}
              </span>
              <div className="space-y-3">
                <p className="text-lg font-semibold leading-7 text-white">{item.title}</p>
                <p className="text-sm leading-7 text-slate-300">{item.text}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mx-auto mt-4 grid max-w-3xl gap-4 md:grid-cols-2">
        {controlItems.slice(3).map((item) => (
          <article key={item.number} className={`flex h-full rounded-[26px] border p-5 sm:p-6 ${item.accent}`}>
            <div className="flex h-full flex-col gap-4">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-semibold ${item.numberClassName}`}
              >
                {item.number}
              </span>
              <div className="space-y-3">
                <p className="text-lg font-semibold leading-7 text-white">{item.title}</p>
                <p className="text-sm leading-7 text-slate-300">{item.text}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="rounded-[28px] border border-white/10 bg-white/5 px-5 py-4 text-sm leading-7 text-slate-200 shadow-[0_18px_60px_rgba(2,6,23,0.16)]">
        Aucune question générée n’est utilisée automatiquement sans validation de l’entreprise.
      </div>
    </CompanySection>
  );
}
