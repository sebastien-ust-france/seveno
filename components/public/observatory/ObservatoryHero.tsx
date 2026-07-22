export function ObservatoryHero() {
  return (
    <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.96),rgba(7,13,24,0.94))] px-6 py-8 shadow-[0_24px_80px_rgba(2,6,23,0.22)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
      <div className="max-w-[980px] space-y-6">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/90">OBSERVATOIRE SEVEN’O</p>
        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Ce que le terrain nous dit déjà sur le recrutement.
        </h1>
        <p className="max-w-4xl text-lg leading-8 text-slate-300">
          Les réponses recueillies dans le cadre de l’étude Seven’O font ressortir plusieurs difficultés communes aux
          candidats et aux entreprises.
        </p>
        <p className="max-w-4xl text-lg leading-8 text-slate-300">
          Ces premiers enseignements nourrissent la construction de Seven’O, sans prétendre représenter à eux seuls
          l’ensemble du marché de l’emploi.
        </p>
      </div>
    </section>
  );
}
