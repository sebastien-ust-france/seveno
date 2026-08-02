const controlBlocks = [
  {
    title: 'Modifiez votre recherche',
    text: 'Mettez à jour vos métiers, votre zone et votre projet professionnel.',
  },
  {
    title: 'Actualisez votre disponibilité',
    text: 'Indiquez le moment où vous êtes réellement prêt à avancer.',
  },
  {
    title: 'Décidez à chaque étape',
    text: 'Une entreprise ne reçoit pas vos coordonnées sans le processus d’accord prévu.',
  },
] as const;

export function CandidateControlSection() {
  return (
    <section className="rounded-[36px] border border-seveno-brand-cyan/20 bg-[linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.94))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.28)] sm:p-8 lg:p-10">
      <div className="space-y-5">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">VOUS GARDEZ LA MAIN</p>
        <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-seveno-text-primary sm:text-4xl">
          Votre <span className="text-seveno-brand-cyan">profil</span> <span className="text-seveno-brand-cyan">évolue</span> avec votre <span className="text-seveno-brand-blue">situation</span>.
        </h2>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {controlBlocks.map((block, index) => (
          <article
            key={block.title}
            className={[
              'relative overflow-hidden rounded-[24px] border p-5',
              index === 0 ? 'border-seveno-brand-cyan/25 bg-seveno-brand-cyan/5' : '',
              index === 1 ? 'border-seveno-brand-cyan/35 bg-seveno-brand-cyan/10' : '',
              index === 2 ? 'border-seveno-brand-blue/30 bg-seveno-brand-blue/10' : '',
            ].join(' ')}
          >
            {index === 1 ? <span aria-hidden="true" className="absolute inset-x-5 top-0 h-px bg-seveno-brand-cyan" /> : null}
            <h3 className="text-lg font-semibold text-seveno-text-primary">
              {index === 2 ? <>Décidez à chaque <span className="text-seveno-brand-warm">étape</span></> : block.title}
            </h3>
            <p className="mt-3 text-sm leading-7 text-seveno-text-secondary">{block.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
