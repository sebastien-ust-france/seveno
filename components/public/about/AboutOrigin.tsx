export function AboutOrigin() {
  return (
    <section className="space-y-6 border-l-2 border-seveno-brand-blue/45 py-2 pl-6 sm:pl-8 lg:pl-10">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">À L’ORIGINE DU PROJET</p>
      <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-seveno-text-primary sm:text-4xl">
        Le <span className="text-seveno-brand-blue">problème</span> n’est pas seulement le CV. C’est tout ce qui se passe <span className="text-seveno-brand-cyan">autour</span>.
      </h2>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <p className="max-w-3xl text-lg leading-8 text-seveno-text-secondary">
          Un CV raconte un parcours, mais il ne dit pas toujours ce qu’une personne sait réellement faire, ce qu’elle
          recherche aujourd’hui ni quand elle sera prête à avancer.
        </p>
        <p className="max-w-3xl text-lg leading-8 text-seveno-text-secondary">
          Une offre décrit un poste, mais elle ne précise pas toujours les critères réellement indispensables, les
          conditions concrètes ou les connaissances qui devront être mobilisées.
        </p>
      </div>

      <p className="max-w-4xl text-lg font-semibold leading-8 text-blue-100">
        Seven’O est construit autour d’une conviction : un recrutement devient plus pertinent lorsque les deux côtés
        disposent des bonnes informations, au bon moment.
      </p>
    </section>
  );
}
