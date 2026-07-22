import Link from 'next/link';

export function CandidateLaunchCta() {
  return (
    <section className="rounded-[36px] border border-cyan-400/12 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),rgba(8,15,28,0.94)_45%)] p-6 shadow-[0_24px_90px_rgba(2,6,23,0.34)] sm:p-8 lg:p-10">
      <div className="space-y-5">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">OUVERTURE PROGRESSIVE</p>
        <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Vous pouvez préparer votre profil dès aujourd’hui.
        </h2>
        <p className="max-w-4xl text-lg leading-8 text-slate-300">
          La création du compte, le profil professionnel, le questionnaire Seven’O et les recommandations sont ouverts aux candidats.
        </p>
        <p className="max-w-4xl text-lg leading-8 text-slate-300">
          Les premières entreprises rejoignent Seven’O progressivement et utilisent déjà le parcours de recrutement. Plus votre profil est clair et à jour, plus il sera prêt lorsque l’opportunité adaptée se présentera.
        </p>
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/connexion"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(99,102,241,0.35)] transition hover:-translate-y-0.5 hover:brightness-110"
        >
          Créer mon profil candidat
        </Link>
        <Link
          href="/connexion"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10"
        >
          J’ai déjà un compte
        </Link>
      </div>
    </section>
  );
}
