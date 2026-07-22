import Link from 'next/link';

const finalActions = [
  {
    href: '/connexion',
    label: 'Créer mon profil candidat',
    className:
      'bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 text-white shadow-[0_18px_50px_rgba(99,102,241,0.35)] hover:-translate-y-0.5 hover:brightness-110',
  },
  {
    href: '/contact',
    label: 'Demander un accès entreprise',
    className: 'border border-white/10 bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/10',
  },
  {
    href: '/etude',
    label: 'Participer à l’étude',
    className: 'border border-white/10 bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/10',
  },
] as const;

export function AboutFinalCta() {
  return (
    <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,15,28,0.95),rgba(6,12,24,0.92))] px-6 py-7 shadow-[0_18px_60px_rgba(2,6,23,0.2)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
      <div className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">
            PARTICIPEZ À LA CONSTRUCTION DE SEVEN’O
          </p>
          <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Candidats, entreprises : la rencontre commence par votre réalité.
          </h2>
          <p className="max-w-4xl text-lg leading-8 text-slate-300">
            Les candidats peuvent préparer leur profil dès aujourd’hui. Les entreprises peuvent demander un accès de
            lancement et découvrir le parcours de recrutement Seven’O.
          </p>
        </div>

        <div className="grid gap-3">
          {finalActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`inline-flex min-h-12 items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition ${action.className}`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
