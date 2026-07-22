export function AboutObservatory() {
  return (
    <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.94),rgba(6,12,24,0.9))] px-6 py-7 shadow-[0_18px_60px_rgba(2,6,23,0.18)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
      <div className="space-y-5">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">
          RECRUTEMENT ET OBSERVATOIRE DES TALENTS
        </p>
        <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Écouter le marché pour faire évoluer la plateforme.
        </h2>
        <p className="max-w-4xl text-lg leading-8 text-slate-300">
          Seven’O ne se limite pas à proposer un nouveau parcours de recrutement. Son observatoire recueille
          également les retours des professionnels et des entreprises afin de mieux comprendre les difficultés
          rencontrées, les attentes qui évoluent et les besoins qui restent mal couverts.
        </p>
        <p className="max-w-4xl text-lg leading-8 text-slate-300">
          Cette écoute nourrit la construction du produit sans mélanger les réponses à l’étude, les profils candidats
          et les recrutements réalisés sur la plateforme.
        </p>
      </div>
    </section>
  );
}
