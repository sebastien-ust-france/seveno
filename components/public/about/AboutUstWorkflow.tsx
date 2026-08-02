export function AboutUstWorkflow() {
  return (
    <section className="space-y-6 rounded-[36px] border border-seveno-brand-blue/25 bg-[radial-gradient(circle_at_top_right,rgb(var(--seveno-brand-blue)/0.14),transparent_36%),linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.94))] px-6 py-7 shadow-[0_24px_80px_rgba(2,6,23,0.24)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">LE PROJET</p>
      <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-seveno-text-primary sm:text-4xl">
        <span className="text-seveno-brand-blue">Seven’O</span> est porté par UST-Workflow.
      </h2>

      <div className="space-y-5">
        <p className="max-w-4xl text-lg leading-8 text-seveno-text-secondary">
          UST-Workflow conçoit des plateformes, des outils métiers et des solutions numériques destinés à simplifier des
          processus devenus trop complexes, trop dispersés ou trop dépendants d’outils mal adaptés.
        </p>
        <p className="max-w-4xl text-lg leading-8 text-seveno-text-secondary">
          Seven’O applique cette démarche au recrutement : observer le fonctionnement actuel, identifier ce qui fait
          perdre du temps aux deux côtés et construire un parcours plus lisible autour des besoins réels.
        </p>
        <p className="max-w-4xl text-lg leading-8 text-seveno-text-secondary">
          Seven’O est développé progressivement, avec une attention particulière portée à la confidentialité, à la
          sécurité des données et à la place de la décision humaine.
        </p>
      </div>
    </section>
  );
}
