export function AboutMission() {
  return (
    <section className="space-y-6 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.95),rgba(7,13,24,0.92))] px-6 py-7 shadow-[0_18px_60px_rgba(2,6,23,0.18)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">NOTRE MISSION</p>
      <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        Mieux préparer la rencontre avant de révéler les identités.
      </h2>
      <p className="max-w-4xl text-lg leading-8 text-slate-300">
        Seven’O ne cherche pas à automatiser la décision ou à remplacer le recruteur. La plateforme organise les
        informations utiles avant l’échange humain.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex h-full flex-col gap-4 rounded-[26px] border border-white/10 bg-white/[0.03] p-6 sm:p-7">
          <h3 className="text-sm font-semibold uppercase tracking-[0.26em] text-cyan-100/90">Pour le candidat</h3>
          <p className="text-lg leading-8 text-slate-200">
            Présenter son projet, son expérience, sa disponibilité, ses aptitudes professionnelles et ses
            recommandations sans commencer par son identité.
          </p>
        </div>

        <div className="flex h-full flex-col gap-4 rounded-[26px] border border-white/10 bg-white/[0.03] p-6 sm:p-7">
          <h3 className="text-sm font-semibold uppercase tracking-[0.26em] text-violet-100/90">Pour l’entreprise</h3>
          <p className="text-lg leading-8 text-slate-200">
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
