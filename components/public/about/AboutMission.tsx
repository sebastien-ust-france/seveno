export function AboutMission() {
  return (
    <section className="space-y-6 rounded-[36px] border border-seveno-brand-cyan/20 bg-[linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.94))] px-6 py-7 shadow-[0_28px_100px_rgba(2,6,23,0.28)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">NOTRE MISSION</p>
      <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-seveno-text-primary sm:text-4xl">
        Mieux <span className="text-seveno-brand-cyan">préparer</span> la <span className="text-seveno-brand-warm">rencontre</span> avant de révéler les identités.
      </h2>
      <p className="max-w-4xl text-lg leading-8 text-seveno-text-secondary">
        Seven’O ne cherche pas à automatiser la décision ou à remplacer le recruteur. La plateforme organise les
        informations utiles avant l’échange humain.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex h-full flex-col gap-4 rounded-[26px] border border-seveno-brand-cyan/25 bg-seveno-brand-cyan/5 p-6 sm:p-7">
          <h3 className="text-sm font-semibold uppercase tracking-[0.26em] text-seveno-brand-cyan">Pour le candidat</h3>
          <p className="text-lg leading-8 text-seveno-text-secondary">
            Présenter son projet, son expérience, sa disponibilité, ses aptitudes professionnelles et ses
            recommandations sans commencer par son identité.
          </p>
        </div>

        <div className="flex h-full flex-col gap-4 rounded-[26px] border border-seveno-brand-blue/25 bg-seveno-brand-blue/5 p-6 sm:p-7">
          <h3 className="text-sm font-semibold uppercase tracking-[0.26em] text-seveno-brand-blue">Pour l’entreprise</h3>
          <p className="text-lg leading-8 text-seveno-text-secondary">
            Définir précisément le besoin, distinguer les prérequis, préparer un questionnaire adapté au poste et
            comprendre les réponses avant de poursuivre.
          </p>
        </div>
      </div>

      <p className="max-w-4xl text-lg font-semibold leading-8 text-cyan-100">
        La technologie structure le parcours. La décision reste humaine.
      </p>
    </section>
  );
}
