import { CompanySection } from '@/components/public/companies/CompanySection';

const thresholdBlocks = [
  {
    title: 'Résultat qualifié',
    text: 'Le score atteint ou dépasse le seuil défini pour l’offre.',
    accent: 'border-cyan-400/15 bg-cyan-400/8',
    numberClassName: 'bg-cyan-400/10 text-cyan-100',
  },
  {
    title: 'Résultat proche du seuil',
    text: 'Le score se situe à moins de cinq points sous le seuil. Le profil peut encore mériter une lecture attentive.',
    accent: 'border-orange-400/15 bg-orange-400/8',
    numberClassName: 'bg-orange-400/10 text-orange-100',
  },
  {
    title: 'Résultat sous le seuil',
    text: 'Le score se situe à plus de cinq points sous le niveau attendu pour ce questionnaire.',
    accent: 'border-white/10 bg-white/5',
    numberClassName: 'bg-white/10 text-slate-100',
  },
] as const;

export function CompanyThresholdSection() {
  return (
    <CompanySection
      eyebrow="SEUIL ET LECTURE DES RÉSULTATS"
      title="Définissez le niveau attendu, sans confier la décision à un score."
      description="Pour chaque questionnaire, vous choisissez un seuil de réussite compris entre 50 % et 100 %, par paliers de 5 points."
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {thresholdBlocks.map((block, index) => (
            <article
              key={block.title}
              className={`flex h-full rounded-[26px] border p-5 shadow-[0_18px_60px_rgba(2,6,23,0.18)] sm:p-6 ${block.accent}`}
            >
              <div className="flex h-full flex-col gap-4">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-semibold ${block.numberClassName}`}
                >
                  {index + 1}
                </span>
                <div className="space-y-3">
                  <p className="text-lg font-semibold leading-7 text-white">{block.title}</p>
                  <p className="text-sm leading-7 text-slate-300">{block.text}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
          <article className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_18px_60px_rgba(2,6,23,0.16)] sm:p-6">
            <p className="text-sm leading-7 text-slate-200">
              Vous consultez le score, le détail des réponses correctes et incorrectes ainsi que la position du candidat par rapport au seuil défini.
            </p>
          </article>
          <article className="rounded-[28px] border border-blue-400/15 bg-[linear-gradient(180deg,rgba(13,14,34,0.98),rgba(8,15,28,0.95))] p-5 shadow-[0_18px_60px_rgba(2,6,23,0.16)] sm:p-6">
            <p className="text-sm leading-7 text-slate-200">
              Seven’O aide à organiser la lecture des candidatures. La décision de poursuivre reste humaine.
            </p>
          </article>
        </div>
      </div>
    </CompanySection>
  );
}
