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
    <section className="rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.96),rgba(8,15,28,0.9))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.24)] sm:p-8 lg:p-10">
      <div className="space-y-5">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">VOUS GARDEZ LA MAIN</p>
        <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Votre profil évolue avec votre situation.
        </h2>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {controlBlocks.map((block) => (
          <article key={block.title} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-semibold text-white">{block.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">{block.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
