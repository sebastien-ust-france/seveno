import Link from 'next/link';

const heroNodes = [
  {
    label: 'Besoin',
    accent: 'border-cyan-400/15 bg-cyan-400/8 text-cyan-100',
  },
  {
    label: 'Critères',
    accent: 'border-violet-400/15 bg-violet-400/8 text-violet-100',
  },
  {
    label: 'Questionnaire',
    accent: 'border-orange-400/15 bg-orange-400/8 text-orange-100',
  },
  {
    label: 'Réponses',
    accent: 'border-white/10 bg-white/5 text-slate-100',
  },
] as const;

export function CompanyPublicHero() {
  return (
    <section className="overflow-hidden rounded-[36px] border border-violet-400/12 bg-[linear-gradient(180deg,rgba(12,14,34,0.98),rgba(8,15,28,0.93))] shadow-[0_28px_100px_rgba(2,6,23,0.34)]">
      <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6 p-6 sm:p-8 lg:p-10 xl:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-200/90">SEVEN’O POUR LES ENTREPRISES</p>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Recrutez sur ce qui compte vraiment pour le poste.
          </h1>
          <p className="max-w-4xl text-lg leading-8 text-slate-300">
            Seven’O transforme votre besoin de recrutement en un parcours clair : des prérequis utiles, un questionnaire ciblé, des résultats lisibles et un intérêt confirmé avant la conversation.
          </p>
          <p className="max-w-4xl text-lg leading-8 text-slate-300">
            Vous ne commencez plus par trier une pile de CV. Vous commencez par le poste, les compétences attendues et les réponses apportées par les candidats.
          </p>
          <div className="pt-2">
            <Link
              href="#questionnaires-seveno"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
            >
              Comprendre les questionnaires
            </Link>
          </div>
        </div>

        <div className="relative border-t border-white/10 p-6 lg:border-l lg:border-t-0 lg:p-8 xl:p-10">
          <div
            aria-hidden="true"
            className="relative min-h-[360px] overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,32,0.96),rgba(7,13,24,0.92))] p-6"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.18),transparent_30%),radial-gradient(circle_at_center,rgba(249,115,22,0.08),transparent_24%)]" />
            <div className="relative flex h-full flex-col justify-between gap-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {heroNodes.slice(0, 2).map((node) => (
                  <div key={node.label} className={`rounded-[24px] border p-4 ${node.accent}`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em]">{node.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center">
                <div className="relative flex h-40 w-40 items-center justify-center rounded-full border border-white/15 bg-slate-950/85 shadow-[0_24px_70px_rgba(2,6,23,0.42)] sm:h-44 sm:w-44 lg:h-48 lg:w-48">
                  <div className="absolute inset-3 rounded-full border border-white/20" />
                  <div className="absolute inset-8 rounded-full border border-cyan-400/20" />
                  <div className="absolute inset-14 rounded-full border border-violet-400/20" />
                  <div className="absolute inset-x-5 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  <div className="absolute inset-y-5 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
                  <span className="relative px-3 text-center text-sm font-semibold uppercase tracking-[0.3em] text-slate-100">
                    Intérêt mutuel
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {heroNodes.slice(2).map((node) => (
                  <div key={node.label} className={`rounded-[24px] border p-4 ${node.accent}`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em]">{node.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
