export function ContactHero() {
  return (
    <section className="rounded-[34px] border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.93))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.34)] sm:p-8 lg:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">CONTACT</p>
      <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        Échanger avec Seven’O.
      </h1>
      <div className="mt-5 space-y-4 text-lg leading-8 text-slate-300">
        <p>
          Une question sur votre profil, une demande d’accès entreprise, un problème de recommandation ou une
          interrogation sur le fonctionnement de Seven’O ? Décrivez votre demande afin qu’elle soit orientée
          correctement.
        </p>
        <p>
          Vous pouvez également nous écrire directement à{' '}
          <a href="mailto:contact@ust-france.com" className="font-medium text-cyan-200 transition hover:text-cyan-100">
            contact@ust-france.com
          </a>
          .
        </p>
      </div>
    </section>
  );
}
