export function AboutLaunch() {
  return (
    <section className="space-y-6 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,15,28,0.92),rgba(6,12,24,0.9))] px-6 py-7 shadow-[0_18px_60px_rgba(2,6,23,0.18)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">OUVERTURE PROGRESSIVE</p>
      <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        Seven’O est déjà en mouvement.
      </h2>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
        <p className="max-w-3xl text-lg leading-8 text-slate-300">
          Les candidats peuvent créer leur compte, compléter leur profil professionnel et réunir leurs recommandations.
        </p>
        <p className="max-w-3xl text-lg leading-8 text-slate-300">
          Les entreprises rejoignent progressivement Seven’O sur demande. Elles peuvent créer leurs offres, définir
          leurs prérequis, préparer leurs questionnaires, recevoir des candidatures et utiliser le parcours de mise en
          relation.
        </p>
      </div>

      <p className="max-w-4xl text-lg leading-8 text-slate-300">
        Cette ouverture progressive permet d’accompagner les premiers utilisateurs, de recueillir leurs retours et
        d’améliorer chaque étape sans perdre de vue l’objectif initial : rendre la rencontre plus claire et plus utile
        des deux côtés.
      </p>
    </section>
  );
}
