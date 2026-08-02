export function ObservatoryHero() {
  return (
    <section className="overflow-hidden rounded-[36px] border border-seveno-brand-cyan/20 bg-[radial-gradient(circle_at_top_right,rgb(var(--seveno-brand-cyan)/0.14),transparent_32%),radial-gradient(circle_at_bottom_left,rgb(var(--seveno-brand-blue)/0.16),transparent_34%),linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.94))] px-6 py-8 shadow-[0_28px_100px_rgba(2,6,23,0.4)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
      <div className="max-w-[980px] space-y-6">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-seveno-brand-cyan">OBSERVATOIRE SEVEN’O</p>
        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-seveno-text-primary sm:text-5xl lg:text-6xl">
          Ce que le <span className="text-seveno-brand-cyan">terrain</span> nous dit déjà sur le <span className="text-seveno-brand-blue">recrutement</span>.
        </h1>
        <p className="max-w-4xl text-lg leading-8 text-seveno-text-secondary">
          Les réponses recueillies dans le cadre de l’étude Seven’O font ressortir plusieurs difficultés communes aux
          candidats et aux entreprises.
        </p>
        <p className="max-w-4xl text-lg leading-8 text-seveno-text-secondary">
          Ces premiers enseignements nourrissent la construction de Seven’O, sans prétendre représenter à eux seuls
          l’ensemble du marché de l’emploi.
        </p>
      </div>
    </section>
  );
}
