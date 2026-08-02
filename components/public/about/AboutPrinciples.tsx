const principles = [
  {
    number: '01',
    title: 'Partir du besoin réel',
    text: 'Le recrutement commence par le poste, les missions, les conditions et les critères réellement utiles.',
  },
  {
    number: '02',
    title: 'Présenter les compétences avant l’identité',
    text: 'Le candidat est d’abord découvert à travers son profil professionnel, pas à travers son nom, sa photo ou son adresse.',
  },
  {
    number: '03',
    title: 'Tenir compte du bon moment',
    text: 'Une compétence n’a pas la même valeur selon que la personne est disponible aujourd’hui, dans un mois ou plus tard.',
  },
  {
    number: '04',
    title: 'Poser des questions liées au poste',
    text: 'Chaque entreprise peut préparer un questionnaire adapté à son offre, le relire, le corriger et définir son niveau d’exigence.',
  },
  {
    number: '05',
    title: 'Avancer après un intérêt mutuel',
    text: 'La conversation se construit lorsque le candidat et l’entreprise souhaitent tous les deux poursuivre.',
  },
  {
    number: '06',
    title: 'Maintenir une décision humaine',
    text: 'Seven’O facilite la lecture et la mise en relation. Il ne décide pas automatiquement qui mérite ou non d’être recruté.',
  },
] as const;

export function AboutPrinciples() {
  return (
    <section className="space-y-6 py-2">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">LES PRINCIPES SEVEN’O</p>
      <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-seveno-text-primary sm:text-4xl">
        Une autre manière d’aborder le <span className="text-seveno-brand-blue">recrutement</span>.
      </h2>

      <ol className="grid gap-6 lg:grid-cols-2 lg:gap-x-12 lg:gap-y-10">
        {principles.map((principle) => (
          <li key={principle.number} className="border-t border-seveno-brand-blue/15 pt-5 sm:pt-6">
            <div className="flex items-start gap-4 sm:gap-5">
              <p className="shrink-0 text-4xl font-semibold tracking-[-0.05em] text-seveno-brand-cyan/60 sm:text-5xl lg:text-6xl">
                {principle.number}
              </p>
              <div className="min-w-0">
                <h3 className="max-w-3xl text-2xl font-semibold tracking-tight text-seveno-text-primary sm:text-[1.65rem]">
                  {principle.title}
                </h3>
                <p className="mt-4 max-w-3xl text-lg leading-8 text-seveno-text-secondary">{principle.text}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
