import Link from 'next/link';

const observedSignals = [
  'Le parcours passé',
  'Les intitulés de poste',
  'Les diplômes',
  'Le nombre d’années d’expérience',
  'L’aisance en entretien',
] as const;

const roleRequirements = [
  'Des connaissances métier',
  'Des méthodes de travail',
  'Des contrôles précis',
  'Des décisions concrètes',
  'Une capacité à réagir en situation',
] as const;

export function CompanyPublicHero() {
  return (
    <section className="overflow-hidden rounded-[36px] border border-seveno-border-active/40 bg-gradient-to-br from-seveno-surface-section via-seveno-surface-panel to-seveno-surface-page shadow-2xl">
      <div className="grid items-stretch lg:grid-cols-[1.12fr_0.88fr]">
        <div className="space-y-6 p-6 sm:p-8 lg:p-10 xl:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-seveno-brand-cyan">LE CONSTAT</p>
          <h1 className="max-w-4xl text-4xl leading-[1.12] font-semibold tracking-tight text-seveno-text-primary sm:text-[2.75rem] sm:leading-[1.1] lg:text-[3.125rem] lg:leading-[1.08] xl:text-[3.375rem]">
            Et si les <span className="text-seveno-brand-cyan">compétences</span> nécessaires au <span className="text-seveno-brand-cyan">poste</span> n’étaient pas réellement <span className="text-seveno-brand-cyan">évaluées</span> avant l’embauche ?
          </h1>

          <div className="max-w-3xl space-y-4 text-base leading-7 text-seveno-text-secondary sm:text-lg sm:leading-8">
            <p>Le CV décrit un parcours. L’entretien permet de rencontrer une personne et d’échanger sur ses expériences.</p>
            <p>
              Mais, dans de nombreux recrutements, les compétences réellement nécessaires au futur poste sont encore déduites d’un intitulé, d’un diplôme, d’un nombre d’années d’expérience ou de la manière dont le candidat présente son parcours.
            </p>
            <p>
              L’entreprise estime alors que ces compétences sont présentes, sans toujours les avoir directement évaluées face aux réalités du poste. La première véritable confrontation intervient parfois seulement après l’embauche, pendant la période d’essai.
            </p>
          </div>

          <p className="max-w-3xl border-l-2 border-seveno-brand-cyan bg-seveno-surface-active px-5 py-4 text-base font-semibold leading-7 text-seveno-text-primary sm:text-lg sm:leading-8">
            Le problème n’est pas seulement que les compétences sont évaluées trop tard. C’est parfois qu’elles ne sont jamais réellement évaluées avant l’embauche.
          </p>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
            <Link
              href="#moteur-seveno"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-seveno-action-primary px-6 py-3 text-center text-sm font-semibold text-seveno-text-on-accent transition hover:bg-seveno-action-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-seveno-surface-page sm:w-auto"
            >
              Découvrir le moteur Seven’O
            </Link>
          </div>
        </div>

        <div className="flex items-center border-t border-seveno-border-subtle p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-8 xl:p-10">
          <div className="w-full space-y-5 rounded-[30px] border border-seveno-border-default bg-seveno-surface-panel p-5 sm:p-6">
            <article className="rounded-[24px] border border-seveno-border-subtle bg-seveno-surface-elevated p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-seveno-text-primary">Ce qui est souvent observé</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-seveno-text-secondary sm:text-base">
                {observedSignals.map((signal) => (
                  <li key={signal} className="flex gap-3">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seveno-text-muted" />
                    <span>{signal}</span>
                  </li>
                ))}
              </ul>
            </article>

            <p className="border-y border-seveno-border-subtle py-3 text-center text-sm font-semibold uppercase tracking-[0.2em] text-seveno-brand-cyan">
              Déduire n’est pas évaluer.
            </p>

            <article className="rounded-[24px] border border-seveno-brand-blue/30 bg-seveno-surface-active p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-seveno-brand-blue">Ce que le poste exige réellement</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-seveno-text-secondary sm:text-base">
                {roleRequirements.map((requirement) => (
                  <li key={requirement} className="flex gap-3">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seveno-brand-blue" />
                    <span>{requirement}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
