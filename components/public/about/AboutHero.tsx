export function AboutHero() {
  return (
    <section className="overflow-hidden rounded-[36px] border border-seveno-brand-cyan/20 bg-[radial-gradient(circle_at_top_right,rgb(var(--seveno-brand-cyan)/0.14),transparent_32%),radial-gradient(circle_at_bottom_left,rgb(var(--seveno-brand-blue)/0.16),transparent_34%),linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.94))] px-6 py-8 shadow-[0_28px_100px_rgba(2,6,23,0.4)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
      <div className="max-w-[980px] space-y-6">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-seveno-brand-cyan">À PROPOS DE SEVEN’O</p>
        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-seveno-text-primary sm:text-5xl lg:text-6xl">
          Le <span className="text-seveno-brand-blue">recrutement</span> mérite mieux qu’un <span className="text-seveno-brand-cyan">échange</span> de CV dans le silence.
        </h1>
        <p className="max-w-4xl text-lg leading-8 text-seveno-text-secondary">
          Seven’O est né d’un constat simple : les candidats envoient trop souvent leurs candidatures sans savoir ce
          qu’elles deviennent, tandis que les entreprises consacrent du temps à trier des profils sans toujours
          connaître leur disponibilité, leur motivation ou leur adéquation réelle au poste.
        </p>
        <p className="max-w-4xl text-lg leading-8 text-seveno-text-secondary">
          Entre les deux, les compétences sont parfois mal comprises, les besoins insuffisamment définis et les
          rencontres arrivent trop tard — lorsqu’elles arrivent.
        </p>
        <p className="max-w-4xl text-lg font-semibold leading-8 text-cyan-100">
          Seven’O veut remettre de la clarté, du timing et de l’intérêt mutuel dans cette rencontre.
        </p>
      </div>
    </section>
  );
}
