import Link from 'next/link';

export function CompanyLaunchCta() {
  return (
    <section className="rounded-[36px] border border-violet-400/12 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.14),rgba(8,15,28,0.95)_48%)] p-6 shadow-[0_24px_90px_rgba(2,6,23,0.34)] sm:p-8 lg:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-violet-200/90">OUVERTURE PROGRESSIVE</p>
      <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        Rejoignez les premières entreprises qui utilisent Seven’O.
      </h2>
      <p className="mt-5 max-w-4xl text-base leading-8 text-slate-300 sm:text-lg">
        L’accès entreprise est ouvert sur demande afin d’accompagner chaque nouvelle organisation pendant la phase de lancement.
      </p>
      <p className="mt-4 max-w-4xl text-base leading-8 text-slate-300 sm:text-lg">
        Les entreprises disposant d’un accès de lancement peuvent créer leurs offres, préparer leurs questionnaires, recevoir des candidatures et utiliser le parcours de mise en relation opérationnel.
      </p>
      <p className="mt-4 max-w-4xl text-base leading-8 text-slate-300 sm:text-lg">
        Elles bénéficient de conditions tarifaires préférentielles pendant cette phase d’ouverture progressive.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/contact"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(99,102,241,0.35)] transition hover:-translate-y-0.5 hover:brightness-110"
        >
          Demander un accès entreprise
        </Link>
        <Link
          href="/comment-ca-marche"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10"
        >
          Voir le fonctionnement complet
        </Link>
      </div>
    </section>
  );
}
