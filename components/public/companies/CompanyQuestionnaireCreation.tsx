import { CompanySection } from '@/components/public/companies/CompanySection';

const creationSteps = [
  {
    number: '1',
    title: 'Décrivez précisément l’offre',
    text: 'Le titre, le métier, les missions, le contexte de travail, le profil recherché et les prérequis servent de base au questionnaire.',
    accent: 'border-cyan-400/15 bg-white/5',
    numberClassName: 'bg-cyan-400/10 text-cyan-100',
  },
  {
    number: '2',
    title: 'Choisissez votre méthode de création',
    text: 'Rédigez le questionnaire manuellement ou utilisez le prompt structuré préparé par Seven’O dans l’IA de votre choix.',
    accent: 'border-violet-400/15 bg-white/5',
    numberClassName: 'bg-violet-400/10 text-violet-100',
  },
  {
    number: '3',
    title: 'Relisez et corrigez la proposition',
    text: 'Modifiez chaque question, les réponses proposées, les bonnes réponses, les explications et le niveau de difficulté avant de valider le questionnaire.',
    accent: 'border-orange-400/15 bg-white/5',
    numberClassName: 'bg-orange-400/10 text-orange-100',
  },
  {
    number: '4',
    title: 'Associez-le à l’offre',
    text: 'Le candidat répond au questionnaire lié au poste. Une autre offre peut disposer d’un questionnaire différent, adapté à ses propres critères.',
    accent: 'border-white/10 bg-white/5',
    numberClassName: 'bg-white/10 text-slate-100',
  },
] as const;

export function CompanyQuestionnaireCreation() {
  return (
    <CompanySection
      eyebrow="UN QUESTIONNAIRE POUR CHAQUE OFFRE"
      title="Partez de votre besoin, puis construisez l’évaluation qui lui correspond."
      description="Chaque offre peut disposer de son propre questionnaire. Vous choisissez la méthode de création et vous gardez la main avant toute utilisation."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {creationSteps.map((step) => (
          <article
            key={step.number}
            className={`flex h-full rounded-[26px] border p-5 shadow-[0_18px_60px_rgba(2,6,23,0.18)] sm:p-6 ${step.accent}`}
          >
            <div className="flex h-full flex-col gap-4">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-semibold ${step.numberClassName}`}
              >
                {step.number}
              </span>
              <div className="space-y-3">
                <p className="text-lg font-semibold leading-7 text-white">{step.title}</p>
                <p className="text-sm leading-7 text-slate-300">{step.text}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </CompanySection>
  );
}
