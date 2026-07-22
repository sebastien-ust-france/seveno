export function CandidateAnonymityIntro() {
  return (
    <section className="rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.96),rgba(8,15,28,0.9))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.28)] sm:p-8 lg:p-10">
      <div className="grid gap-8 lg:grid-cols-[0.98fr_1.02fr] lg:items-center">
        <div className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">UN PROFIL PROFESSIONNEL AVANT UNE IDENTITÉ</p>
          <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Montrez ce qui compte, sans être jugé trop tôt.
          </h2>
          <p className="max-w-3xl text-lg leading-8 text-slate-300">
            Votre nom, votre email, votre téléphone, votre photo et votre adresse précise restent privés. L’entreprise découvre d’abord vos métiers recherchés, votre expérience, votre disponibilité, votre présentation professionnelle, votre questionnaire Seven’O et vos recommandations.
          </p>
          <p className="max-w-3xl text-lg leading-8 text-cyan-100">
            L’anonymat ne vous efface pas. Il remet votre parcours et votre projet au centre de la première décision.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,32,0.96),rgba(7,13,24,0.92))] p-6">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.16),transparent_34%),radial-gradient(circle_at_center,rgba(249,115,22,0.07),transparent_22%)]"
          />
          <div className="relative flex min-h-[340px] items-center justify-center sm:min-h-[380px] lg:min-h-[420px]">
            <div className="relative h-[160px] w-[160px] sm:h-[190px] sm:w-[190px] md:h-[220px] md:w-[220px] lg:h-[250px] lg:w-[250px] xl:h-[272px] xl:w-[272px]">
              <div className="absolute inset-0 rounded-full border border-white/25 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),rgba(15,23,42,0.9))] shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_60px_rgba(2,6,23,0.35)]" />
              <div className="absolute inset-[10px] rounded-full border border-white/35 sm:inset-[12px] md:inset-[14px] lg:inset-[16px]" />
              <div className="absolute inset-[22px] rounded-full border border-white/45 sm:inset-[28px] md:inset-[34px] lg:inset-[40px]" />
              <div className="absolute inset-[36px] rounded-full border border-white/55 sm:inset-[44px] md:inset-[52px] lg:inset-[60px]" />
              <div className="absolute inset-[35px] flex items-center justify-center rounded-full border border-red-300/70 bg-gradient-to-br from-rose-700 via-red-600 to-red-800 shadow-[inset_0_1px_2px_rgba(255,255,255,0.1),0_0_0_1px_rgba(255,255,255,0.08),0_0_20px_rgba(220,38,38,0.18)] sm:inset-[47px] md:inset-[58px] lg:inset-[68px] xl:inset-[76px]">
                <span className="px-2 text-center text-[0.68rem] font-semibold uppercase leading-[1.08] tracking-[0.16em] text-white sm:text-[0.72rem] md:text-[0.8rem] lg:text-xs">
                  Vous êtes
                  <br />
                  la cible
                </span>
              </div>
            </div>

            <div className="absolute left-6 top-10 max-w-[10rem] rounded-[20px] border border-cyan-400/15 bg-cyan-400/8 px-4 py-3 text-sm font-medium text-slate-200 shadow-[0_20px_60px_rgba(2,6,23,0.18)]">
              Profil anonyme
            </div>
            <div className="absolute right-4 top-16 max-w-[10rem] rounded-[20px] border border-violet-400/15 bg-violet-400/8 px-4 py-3 text-sm font-medium text-slate-200 shadow-[0_20px_60px_rgba(2,6,23,0.18)]">
              Questionnaire Seven’O
            </div>
            <div className="absolute bottom-8 left-10 max-w-[11rem] rounded-[20px] border border-orange-400/15 bg-orange-400/8 px-4 py-3 text-sm font-medium text-slate-200 shadow-[0_20px_60px_rgba(2,6,23,0.18)]">
              Intérêt partagé
            </div>
            <div className="absolute bottom-14 right-8 max-w-[10rem] rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 shadow-[0_20px_60px_rgba(2,6,23,0.18)]">
              Première lecture
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
