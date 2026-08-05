import { CompanySection } from '@/components/public/companies/CompanySection';

export function CompanyCandidateQuestionnaire() {
  return (
    <CompanySection
      eyebrow="UNE ÉVALUATION COURTE ET CADRÉE"
      title="Le candidat répond à un questionnaire directement lié au poste."
      description=""
    >
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-center">
        <div className="space-y-5">
          <p className="max-w-4xl text-lg leading-8 text-slate-300">
            Le questionnaire entreprise contient 20 questions. Elles sont présentées une par une, avec 30 secondes
            pour répondre à chacune.
          </p>
          <p className="max-w-4xl text-lg leading-8 text-slate-300">
            L’ordre des questions est mélangé pour chaque tentative afin de limiter les réponses préparées ou
            partagées, tout en restant stable pendant la session du candidat.
          </p>
          <p className="max-w-4xl text-lg font-semibold leading-8 text-cyan-100">
            Le questionnaire évalue les critères du poste. Il ne remplace ni l’étude du profil ni l’échange humain.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,32,0.96),rgba(7,13,24,0.92))] p-6 shadow-[0_24px_90px_rgba(2,6,23,0.24)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.16),transparent_30%),radial-gradient(circle_at_center,rgba(249,115,22,0.08),transparent_24%)]" />
          <div className="relative flex min-h-[260px] flex-col justify-between gap-5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-100/90">20 QUESTIONS</span>
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-100/90">30 SECONDES</span>
            </div>

            <div className="flex flex-1 items-center justify-center">
              <div
                aria-hidden="true"
                className="relative w-[min(100%,250px)] -rotate-2 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(250,252,255,0.98),rgba(238,244,252,0.96))] px-5 py-5 shadow-[0_26px_70px_rgba(15,23,42,0.32)] sm:w-[240px] lg:w-[260px]"
              >
                <div className="absolute left-5 top-4 h-3 w-16 rounded-full bg-cyan-200/70" />
                <div className="absolute right-5 top-4 flex h-7 w-7 items-center justify-center rounded-full border border-slate-300/80 bg-white text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  30 s
                </div>

                <div className="mt-7 space-y-4">
                  <div className="space-y-2">
                    <div className="h-2.5 w-24 rounded-full bg-slate-300/90" />
                    <div className="h-2.5 w-4/5 rounded-full bg-slate-200/90" />
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-400/70 bg-white">
                      <span className="h-2 w-2 rounded-full bg-slate-500/80" />
                    </span>
                    <div className="h-2.5 flex-1 rounded-full bg-slate-200/90" />
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="flex h-4 w-4 items-center justify-center rounded-sm border border-slate-400/70 bg-white">
                      <span className="h-1.5 w-1.5 rounded-[2px] bg-sky-500/80" />
                    </span>
                    <div className="h-2.5 flex-1 rounded-full bg-slate-200/90" />
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-400/70 bg-white" />
                    <div className="h-2.5 flex-1 rounded-full bg-slate-200/90" />
                  </div>

                  <div className="pt-2">
                    <div className="space-y-2">
                      <div className="h-2 rounded-full bg-slate-300/90" />
                      <div className="h-2 rounded-full bg-slate-200/90" />
                      <div className="h-2 rounded-full bg-slate-200/80" />
                    </div>
                  </div>
                </div>

                <div className="absolute inset-x-4 bottom-4 flex items-center justify-between">
                  <div className="h-1.5 w-14 rounded-full bg-slate-300/80" />
                  <div className="h-1.5 w-10 rounded-full bg-slate-300/60" />
                </div>
                <div className="absolute inset-y-4 left-3 w-px rounded-full bg-slate-300/70" />
                <div className="absolute inset-y-4 right-3 w-px rounded-full bg-slate-300/50" />
              </div>
            </div>

            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/90" />
                ORDRE MÉLANGÉ
              </span>
            </div>
          </div>
        </div>
      </div>
    </CompanySection>
  );
}
