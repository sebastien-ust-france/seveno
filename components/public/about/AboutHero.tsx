export function AboutHero() {
  return (
    <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.96),rgba(7,13,24,0.94))] px-6 py-8 shadow-[0_24px_80px_rgba(2,6,23,0.22)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
      <div className="max-w-[980px] space-y-6">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/90">À PROPOS DE SEVEN’O</p>
        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Le recrutement mérite mieux qu’un échange de CV dans le silence.
        </h1>
        <p className="max-w-4xl text-lg leading-8 text-slate-300">
          Seven’O est né d’un constat simple : les candidats envoient trop souvent leurs candidatures sans savoir ce
          qu’elles deviennent, tandis que les entreprises consacrent du temps à trier des profils sans toujours
          connaître leur disponibilité, leur motivation ou leur adéquation réelle au poste.
        </p>
        <p className="max-w-4xl text-lg leading-8 text-slate-300">
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
