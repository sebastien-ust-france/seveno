export function AboutUstWorkflow() {
  return (
    <section className="space-y-6 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.95),rgba(7,13,24,0.92))] px-6 py-7 shadow-[0_18px_60px_rgba(2,6,23,0.18)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">LE PROJET</p>
      <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        Seven’O est porté par UST-Workflow.
      </h2>

      <div className="space-y-5">
        <p className="max-w-4xl text-lg leading-8 text-slate-300">
          UST-Workflow conçoit des plateformes, des outils métiers et des solutions numériques destinés à simplifier des
          processus devenus trop complexes, trop dispersés ou trop dépendants d’outils mal adaptés.
        </p>
        <p className="max-w-4xl text-lg leading-8 text-slate-300">
          Seven’O applique cette démarche au recrutement : observer le fonctionnement actuel, identifier ce qui fait
          perdre du temps aux deux côtés et construire un parcours plus lisible autour des besoins réels.
        </p>
        <p className="max-w-4xl text-lg leading-8 text-slate-300">
          Seven’O est développé progressivement, avec une attention particulière portée à la confidentialité, à la
          sécurité des données et à la place de la décision humaine.
        </p>
      </div>
    </section>
  );
}
