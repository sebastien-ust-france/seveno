const principles = [
  'Partir du besoin réel de l’entreprise.',
  'Présenter d’abord les éléments professionnels.',
  'Tenir compte de la disponibilité réelle.',
  'Évaluer les critères propres au poste.',
  'Avancer après un intérêt mutuel.',
] as const;

export function ObservatoryPrinciples() {
  return (
    <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.92),rgba(7,13,24,0.9))] px-6 py-7 shadow-[0_18px_60px_rgba(2,6,23,0.18)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">CE QUE SEVEN’O EN RETIENT</p>
      <h2 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        Mieux préparer la rencontre, des deux côtés.
      </h2>
      <p className="mt-5 max-w-4xl text-lg leading-8 text-slate-300">
        Ces premiers retours confortent les principes fondateurs de Seven’O : partir du besoin réel, présenter les
        profils sans préjugé lié à l’identité, tenir compte de la disponibilité, utiliser des questionnaires adaptés
        au poste et avancer uniquement lorsque les deux parties souhaitent poursuivre.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5">
        {principles.map((principle) => (
          <div key={principle} className="flex items-start gap-3 border-t border-white/8 pt-4">
            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-[2px] bg-cyan-300/90 shadow-[0_0_0_6px_rgba(34,211,238,0.08)]" />
            <div className="min-w-0">
              <p className="text-base leading-7 text-slate-200">{principle}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
