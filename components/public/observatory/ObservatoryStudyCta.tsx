import Link from 'next/link';

const studyActions = [
  {
    href: '/etude',
    label: 'Participer à l’étude',
    className: 'bg-seveno-action-primary text-seveno-text-on-accent hover:bg-seveno-action-primary-hover',
  },
  {
    href: '/candidats',
    label: 'Découvrir Seven’O pour les candidats',
    className: 'border border-seveno-brand-blue/40 bg-seveno-brand-blue/10 text-seveno-text-primary hover:border-seveno-brand-blue/65 hover:bg-seveno-brand-blue/15',
  },
  {
    href: '/entreprises',
    label: 'Découvrir Seven’O pour les entreprises',
    className: 'border border-seveno-brand-blue/40 bg-seveno-brand-blue/10 text-seveno-text-primary hover:border-seveno-brand-blue/65 hover:bg-seveno-brand-blue/15',
  },
] as const;

export function ObservatoryStudyCta() {
  return (
    <section className="relative overflow-hidden rounded-[36px] border border-seveno-brand-cyan/25 bg-[radial-gradient(circle_at_top_right,rgb(var(--seveno-brand-blue)/0.2),transparent_34%),radial-gradient(circle_at_bottom_left,rgb(var(--seveno-brand-cyan)/0.16),transparent_32%),linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.94))] px-6 py-7 shadow-[0_28px_100px_rgba(2,6,23,0.34)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
      <div className="grid gap-7 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
        <div className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">L’ÉTUDE CONTINUE</p>
          <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-seveno-text-primary sm:text-4xl">
            Chaque réponse affine notre <span className="text-seveno-brand-cyan">compréhension</span> du <span className="text-seveno-brand-blue">terrain</span>.
          </h2>
          <p className="max-w-3xl text-lg leading-8 text-seveno-text-secondary">
            Les attentes des professionnels et des entreprises évoluent. L’étude Seven’O reste ouverte afin de
            continuer à écouter le marché et de construire la plateforme au plus près des réalités du recrutement.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:justify-items-stretch">
          {studyActions.map((action) => (
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
