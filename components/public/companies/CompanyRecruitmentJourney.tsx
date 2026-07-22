import { CompanySection } from '@/components/public/companies/CompanySection';

const journeySteps = [
  {
    number: '1',
    title: 'Créez votre offre',
    text: 'Décrivez le poste, les missions, les conditions et le profil recherché.',
  },
  {
    number: '2',
    title: 'Définissez les prérequis',
    text: 'Distinguez les critères obligatoires des éléments qui représentent une valeur ajoutée.',
  },
  {
    number: '3',
    title: 'Préparez le questionnaire',
    text: 'Créez-le manuellement ou importez une proposition générée à partir du prompt Seven’O.',
  },
  {
    number: '4',
    title: 'Recevez les candidatures',
    text: 'Le candidat confirme les prérequis et répond au questionnaire propre à l’offre.',
  },
  {
    number: '5',
    title: 'Analysez les résultats',
    text: 'Consultez le profil anonyme, les recommandations, le score et le détail des réponses.',
  },
  {
    number: '6',
    title: 'Confirmez votre intérêt',
    text: 'Validez la candidature puis la mise en relation lorsque vous souhaitez poursuivre.',
  },
  {
    number: '7',
    title: 'Commencez la conversation',
    text: 'Après les validations prévues, la messagerie s’ouvre et l’échange peut commencer.',
  },
] as const;

export function CompanyRecruitmentJourney() {
  return (
    <CompanySection
      eyebrow="LE PARCOURS RECRUTEUR"
      title="Du besoin à la conversation, chaque étape reste lisible."
      description="Seven’O relie les critères du poste, les réponses du candidat et la validation des deux parties dans un même parcours."
    >
      <div className="relative">
        <div className="absolute left-6 top-6 bottom-6 w-px bg-white/10 lg:hidden" />
        <div className="absolute left-8 right-8 top-12 hidden h-px bg-white/10 lg:block" />

        <ol className="grid gap-4 lg:grid-cols-7">
          {journeySteps.map((step) => (
            <li key={step.number} className="relative flex">
              <article className="relative flex h-full w-full flex-col rounded-[26px] border border-white/10 bg-white/5 p-5 pt-14 shadow-[0_18px_60px_rgba(2,6,23,0.18)] sm:p-6 sm:pt-14">
                <span className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#071022] text-base font-semibold text-cyan-100 lg:left-1/2 lg:-translate-x-1/2">
                  {step.number}
                </span>
                <p className="text-lg font-semibold leading-7 text-white">{step.title}</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">{step.text}</p>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </CompanySection>
  );
}
