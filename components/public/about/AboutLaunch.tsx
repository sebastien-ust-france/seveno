export function AboutLaunch() {
  return (
    <section className="space-y-6 py-2">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">OUVERTURE PROGRESSIVE</p>
      <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-seveno-text-primary sm:text-4xl">
        <span className="text-seveno-brand-blue">Seven’O</span> est déjà en <span className="text-seveno-brand-cyan">mouvement</span>.
      </h2>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
        <p className="max-w-3xl text-lg leading-8 text-seveno-text-secondary">
          Les candidats peuvent créer leur compte, compléter leur profil professionnel et réunir leurs recommandations.
        </p>
        <p className="max-w-3xl text-lg leading-8 text-seveno-text-secondary">
          Les entreprises rejoignent progressivement Seven’O sur demande. Elles peuvent créer leurs offres, définir
          leurs prérequis, préparer leurs questionnaires, recevoir des candidatures et utiliser le parcours de mise en
          relation.
        </p>
      </div>

      <p className="max-w-4xl text-lg leading-8 text-seveno-text-secondary">
        Cette ouverture progressive permet d’accompagner les premiers utilisateurs, de recueillir leurs retours et
        d’améliorer chaque étape sans perdre de vue l’objectif initial : rendre la rencontre plus claire et plus utile
        des deux côtés.
      </p>
    </section>
  );
}
