import Link from 'next/link';

const finalActions = [
  {
    href: '/connexion',
    label: 'Créer mon profil candidat',
    className: 'bg-seveno-action-primary text-seveno-text-on-accent hover:bg-seveno-action-primary-hover',
  },
  {
    href: '/contact',
    label: 'Demander un accès entreprise',
    className: 'border border-seveno-brand-blue/40 bg-seveno-brand-blue/10 text-seveno-text-primary hover:border-seveno-brand-blue/65 hover:bg-seveno-brand-blue/15',
  },
  {
    href: '/etude',
    label: 'Participer à l’étude',
    className: 'border border-seveno-brand-blue/40 bg-seveno-brand-blue/10 text-seveno-text-primary hover:border-seveno-brand-blue/65 hover:bg-seveno-brand-blue/15',
  },
] as const;

export function AboutFinalCta() {
  return (
    <section className="relative overflow-hidden rounded-[36px] border border-seveno-brand-cyan/25 bg-[radial-gradient(circle_at_top_right,rgb(var(--seveno-brand-blue)/0.2),transparent_34%),radial-gradient(circle_at_bottom_left,rgb(var(--seveno-brand-cyan)/0.16),transparent_32%),linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.94))] px-6 py-7 shadow-[0_28px_100px_rgba(2,6,23,0.34)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
      <div className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">
            PARTICIPEZ À LA CONSTRUCTION DE SEVEN’O
          </p>
          <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-seveno-text-primary sm:text-4xl">
            <span className="text-seveno-brand-cyan">Candidats</span>, <span className="text-seveno-brand-blue">entreprises</span> : la <span className="text-seveno-brand-warm">rencontre</span> commence par votre réalité.
          </h2>
          <p className="max-w-4xl text-lg leading-8 text-seveno-text-secondary">
            Les candidats peuvent préparer leur profil dès aujourd’hui. Les entreprises peuvent demander un accès de
            lancement et découvrir le parcours de recrutement Seven’O.
          </p>
        </div>

        <div className="grid gap-3">
          {finalActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus ${action.className}`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
