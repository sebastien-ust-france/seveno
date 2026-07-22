import Link from 'next/link';

export function CandidatePublicHero() {
  return (
    <section className="overflow-hidden rounded-[36px] border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.93))] shadow-[0_28px_100px_rgba(2,6,23,0.34)]">
      <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6 p-6 sm:p-8 lg:p-10 xl:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/90">SEVEN’O POUR LES CANDIDATS</p>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Votre parcours professionnel mérite mieux qu’un tri de CV.
          </h1>
          <p className="max-w-4xl text-lg leading-8 text-slate-300">
            Seven’O vous permet de présenter ce que vous savez faire, ce que vous recherchez et le moment où vous serez disponible, sans exposer votre identité avant qu’une opportunité mérite d’aller plus loin.
          </p>
          <p className="max-w-4xl text-lg leading-8 text-slate-300">
            Les entreprises découvrent d’abord un profil professionnel anonyme. La rencontre se construit ensuite sur des critères précis, des réponses concrètes et un intérêt partagé.
          </p>
          <div className="pt-2">
            <Link
              href="#parcours-candidat"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
            >
              Découvrir le parcours candidat
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
                <div className="rounded-[24px] border border-cyan-400/15 bg-cyan-400/8 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/90">Profil professionnel</p>
                  <p className="mt-3 text-sm leading-7 text-slate-200">
                    Ce que vous savez faire, ce que vous recherchez et la manière dont vous souhaitez avancer.
                  </p>
                </div>
                <div className="rounded-[24px] border border-violet-400/15 bg-violet-400/8 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-100/90">Opportunité</p>
                  <p className="mt-3 text-sm leading-7 text-slate-200">
                    Un besoin précis, des critères utiles et un contexte de travail à comprendre avant d’aller plus loin.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <div
                  aria-hidden="true"
                  className="relative flex h-36 w-36 items-center justify-center sm:h-40 sm:w-40 lg:h-44 lg:w-44"
                >
                  <span className="relative z-0 text-5xl font-black leading-none tracking-[0.16em] text-slate-100/90 sm:text-6xl lg:text-7xl">
                    CV
                  </span>
                  <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[5px] w-[138%] -translate-x-1/2 -translate-y-1/2 rotate-[-30deg] rounded-full bg-rose-500/90 shadow-[0_0_18px_rgba(244,63,94,0.35)] sm:h-[6px] lg:h-[7px]" />
                  <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[5px] w-[138%] -translate-x-1/2 -translate-y-1/2 rotate-[30deg] rounded-full bg-rose-500/90 shadow-[0_0_18px_rgba(244,63,94,0.35)] sm:h-[6px] lg:h-[7px]" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] border border-orange-400/15 bg-orange-400/8 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-100/90">Disponibilité réelle</p>
                  <p className="mt-3 text-sm leading-7 text-slate-200">
                    Un moment choisi pour avancer ensemble, sans brûler les étapes.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/90">Lecture anonyme</p>
                  <p className="mt-3 text-sm leading-7 text-slate-200">
                    La première décision commence par le parcours, pas par l’identité.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
