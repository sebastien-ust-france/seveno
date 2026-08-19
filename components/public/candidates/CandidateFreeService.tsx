export function CandidateFreeService() {
  return (
    <section className="rounded-[36px] border border-seveno-brand-blue/25 bg-[linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.94))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.28)] sm:p-8 lg:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">VOTRE PARCOURS</p>
      <h2 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-seveno-text-primary sm:text-4xl">
        Un service gratuit pour les candidats
      </h2>
      <div className="mt-5 max-w-4xl space-y-3 text-lg leading-8 text-seveno-text-secondary">
        <p>Seven’O est gratuit pour les candidats. Les entreprises financent l’utilisation des outils de recrutement, jamais l’achat d’une candidature ou l’accès automatique à vos données personnelles.</p>
        <p>Vos coordonnées ne sont partagées que lorsque vous choisissez vous-même de les transmettre.</p>
      </div>
    </section>
  );
}
