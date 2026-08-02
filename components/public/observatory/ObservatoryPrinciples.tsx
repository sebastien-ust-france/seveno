const principles = [
  'Partir du besoin réel de l’entreprise.',
  'Présenter d’abord les éléments professionnels.',
  'Tenir compte de la disponibilité réelle.',
  'Évaluer les critères propres au poste.',
  'Avancer après un intérêt mutuel.',
] as const;

export function ObservatoryPrinciples() {
  return (
    <section className="border-l-2 border-seveno-brand-cyan/45 py-2 pl-6 sm:pl-8 lg:pl-10">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">CE QUE SEVEN’O EN RETIENT</p>
      <h2 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-seveno-text-primary sm:text-4xl">
        Mieux <span className="text-seveno-brand-cyan">préparer</span> la <span className="text-seveno-brand-blue">rencontre</span>, des deux côtés.
      </h2>
      <p className="mt-5 max-w-4xl text-lg leading-8 text-seveno-text-secondary">
        Ces premiers retours confortent les principes fondateurs de Seven’O : partir du besoin réel, présenter les
        profils sans préjugé lié à l’identité, tenir compte de la disponibilité, utiliser des questionnaires adaptés
        au poste et avancer uniquement lorsque les deux parties souhaitent poursuivre.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5">
        {principles.map((principle) => (
          <div key={principle} className="flex items-start gap-3 border-t border-seveno-brand-blue/15 pt-4">
            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-[2px] bg-seveno-brand-cyan shadow-[0_0_0_6px_rgb(var(--seveno-brand-cyan)/0.08)]" />
            <div className="min-w-0">
              <p className="text-base leading-7 text-seveno-text-secondary">{principle}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
