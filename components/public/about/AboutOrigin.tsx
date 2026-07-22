export function AboutOrigin() {
  return (
    <section className="space-y-6 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,15,28,0.92),rgba(6,12,24,0.9))] px-6 py-7 shadow-[0_18px_60px_rgba(2,6,23,0.18)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">À L’ORIGINE DU PROJET</p>
      <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        Le problème n’est pas seulement le CV. C’est tout ce qui se passe autour.
      </h2>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <p className="max-w-3xl text-lg leading-8 text-slate-300">
          Un CV raconte un parcours, mais il ne dit pas toujours ce qu’une personne sait réellement faire, ce qu’elle
          recherche aujourd’hui ni quand elle sera prête à avancer.
        </p>
        <p className="max-w-3xl text-lg leading-8 text-slate-300">
          Une offre décrit un poste, mais elle ne précise pas toujours les critères réellement indispensables, les
          conditions concrètes ou les connaissances qui devront être mobilisées.
        </p>
      </div>

      <p className="max-w-4xl text-lg font-semibold leading-8 text-violet-100">
        Seven’O est construit autour d’une conviction : un recrutement devient plus pertinent lorsque les deux côtés
        disposent des bonnes informations, au bon moment.
      </p>
    </section>
  );
}
