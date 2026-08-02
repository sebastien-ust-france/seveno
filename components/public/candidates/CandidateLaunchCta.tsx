import Link from 'next/link';

export function CandidateLaunchCta() {
  return (
    <section className="relative overflow-hidden rounded-[36px] border border-seveno-brand-cyan/25 bg-[radial-gradient(circle_at_top_right,rgb(var(--seveno-brand-blue)/0.2),transparent_34%),radial-gradient(circle_at_bottom_left,rgb(var(--seveno-brand-cyan)/0.16),transparent_32%),linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.94))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.34)] sm:p-8 lg:p-10">
      <div className="space-y-5">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">OUVERTURE PROGRESSIVE</p>
        <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-seveno-text-primary sm:text-4xl">
          Vous pouvez <span className="text-seveno-brand-cyan">préparer</span> votre <span className="text-seveno-brand-cyan">profil</span> dès <span className="text-seveno-brand-blue">aujourd’hui</span>.
        </h2>
        <p className="max-w-4xl text-lg leading-8 text-seveno-text-secondary">
          La création du compte, le profil professionnel, le questionnaire Seven’O et les recommandations sont ouverts aux candidats.
        </p>
        <p className="max-w-4xl text-lg leading-8 text-seveno-text-secondary">
          Les premières entreprises rejoignent Seven’O progressivement et utilisent déjà le parcours de recrutement. Plus votre profil est clair et à jour, plus il sera prêt lorsque l’opportunité adaptée se présentera.
        </p>
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/connexion"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-seveno-action-primary px-6 py-3 text-sm font-semibold text-seveno-text-on-accent transition hover:bg-seveno-action-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-seveno-surface-page"
        >
          Créer mon profil candidat
        </Link>
        <Link
          href="/connexion"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-seveno-brand-blue/40 bg-seveno-brand-blue/10 px-6 py-3 text-sm font-semibold text-seveno-text-primary transition hover:border-seveno-brand-blue/65 hover:bg-seveno-brand-blue/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus"
        >
          J’ai déjà un compte
        </Link>
      </div>
    </section>
  );
}
