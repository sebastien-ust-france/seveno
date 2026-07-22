import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { HomeFaqSection } from '@/components/public/HomeFaqSection';
import { PublicSiteShell } from '@/components/public/PublicSiteShell';
import { getPublicStudyResponseCount } from '@/lib/study-public';

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

export const revalidate = 900;

const availableTodaySteps = [
  {
    title: 'Créer son compte',
    description: 'Accédez à votre espace candidat et commencez à construire votre profil professionnel.',
  },
  {
    title: 'Préciser sa recherche et sa disponibilité',
    description: 'Indiquez les métiers recherchés, votre zone, votre expérience et le moment où vous serez disponible.',
  },
  {
    title: 'Présenter son parcours',
    description: 'Expliquez ce que vous diriez de vous et ce que les autres reconnaissent dans votre travail.',
  },
  {
    title: 'Compléter le questionnaire Seven’O',
    description: 'Le questionnaire d’aptitudes générales enrichit votre profil en faisant ressortir votre manière de comprendre, d’organiser, de résoudre et de collaborer.',
  },
  {
    title: 'Réunir ses recommandations',
    description: 'Demandez plusieurs recommandations indépendantes à d’anciens employeurs, responsables ou partenaires professionnels.',
  },
] as const;

const recruiterSteps = [
  {
    title: 'Définir le besoin réel',
    description: 'Clarifiez le poste, les missions, le contexte de travail et les critères réellement utiles au recrutement.',
    className: 'xl:col-span-2',
  },
  {
    title: 'Distinguer l’indispensable du souhaitable',
    description: 'Séparez les prérequis obligatoires des éléments qui représentent une véritable valeur ajoutée.',
    className: 'xl:col-span-2',
  },
  {
    title: 'Poser les bonnes questions',
    description: 'Associez au poste un questionnaire ciblé pour évaluer des connaissances et des situations concrètes.',
    className: 'xl:col-span-2',
  },
  {
    title: 'Comprendre les profils disponibles',
    description: 'Appuyez-vous sur les compétences, la disponibilité et les recommandations professionnelles, sans commencer par l’identité du candidat.',
    className: 'md:col-span-1 xl:col-start-2 xl:col-span-2',
  },
  {
    title: 'Avancer après un intérêt mutuel',
    description: 'La conversation commence lorsque les deux parties souhaitent poursuivre, avant la révélation progressive des identités.',
    className: 'md:col-span-2 xl:col-start-4 xl:col-span-2',
  },
] as const;

const observatoryFocusItems = [
  'Ce que recherchent aujourd’hui les professionnels.',
  'Les difficultés rencontrées par les candidats et les recruteurs.',
  'L’évolution des métiers, des compétences et des disponibilités.',
  'Les attentes envers de nouvelles façons de recruter.',
] as const;

function formatParticipationMessage(totalResponses: number) {
  if (totalResponses <= 0) {
    return 'Soyez la première personne à participer à l’étude Seven’O.';
  }

  if (totalResponses === 1) {
    return "1 personne a déjà participé à l’étude Seven'O.";
  }

  return `${totalResponses} personnes ont déjà participé à l’étude Seven'O.`;
}

function PageSection({
  eyebrow,
  title,
  description,
  children,
  className = '',
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        'rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.96),rgba(8,15,28,0.9))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.28)] sm:p-8 lg:p-10',
        className,
      ].join(' ')}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">{eyebrow}</p>
      <h2 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h2>
      <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">{description}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function NumberedStep({
  index,
  title,
  description,
}: {
  index: number;
  title: string;
  description: string;
}) {
  return (
    <article className="flex h-full rounded-[26px] border border-white/10 bg-white/5 p-5 shadow-[0_18px_60px_rgba(2,6,23,0.18)]">
      <div className="flex h-full items-start gap-4 text-left">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 text-base font-semibold text-cyan-100">
          {index}
        </span>
        <div className="min-w-0">
          <div className="lg:min-h-[4.5rem]">
            <p className="text-lg font-semibold leading-7 text-white">{title}</p>
          </div>
          <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
        </div>
      </div>
    </article>
  );
}

function ProgressiveLaunchStep({
  index,
  title,
  description,
  href,
  buttonLabel,
  className = '',
  accentClassName = '',
  buttonClassName = '',
}: {
  index: number;
  title: string;
  description: string;
  href?: string;
  buttonLabel?: string;
  className?: string;
  accentClassName?: string;
  buttonClassName?: string;
}) {
  return (
    <article
      className={[
        'flex h-full rounded-[28px] border p-5 shadow-[0_18px_60px_rgba(2,6,23,0.18)] sm:p-6',
        className,
      ].join(' ')}
    >
      <div className="flex h-full flex-1 items-start gap-4 text-left">
        <span
          className={[
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-semibold',
            accentClassName || 'bg-white/8 text-white',
          ].join(' ')}
        >
          {index}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="lg:min-h-[4.5rem]">
            <p className="text-lg font-semibold leading-7 text-white">{title}</p>
          </div>
          <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
          {href && buttonLabel ? (
            <Link
              href={href}
              className={[
                'mt-auto inline-flex min-h-11 items-center justify-center self-start rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:brightness-110',
                buttonClassName,
              ].join(' ')}
            >
              {buttonLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function HeroBrandComposition() {
  return (
    <div className="relative overflow-hidden rounded-[34px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(11,19,36,0.98),rgba(8,15,28,0.96))] p-5 shadow-[0_30px_100px_rgba(2,6,23,0.42)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.16),transparent_30%),radial-gradient(circle_at_center,rgba(249,115,22,0.08),transparent_22%)]" />
      <div className="relative flex min-h-[380px] flex-col justify-between gap-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-[0_18px_60px_rgba(2,6,23,0.16)]">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200/85">PROFESSIONNEL</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Compétences', 'Disponibilité', 'Expérience', 'Recommandations'].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 py-2 lg:py-0">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/15 bg-slate-950/90 text-5xl font-semibold text-white shadow-[0_24px_70px_rgba(2,6,23,0.45)]">
              7
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
              Zone de rencontre
            </div>
            <div className="rounded-full border border-violet-300/20 bg-violet-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-violet-100">
              Intérêt mutuel
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-left shadow-[0_18px_60px_rgba(2,6,23,0.16)] lg:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-violet-200/85">ENTREPRISE</p>
            <div className="mt-4 flex flex-wrap gap-2 lg:justify-end">
              {['Besoin', 'Critères', 'Prérequis', 'Opportunité'].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-violet-300/15 bg-violet-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-100"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[26px] border border-white/10 bg-[#0a1223]/75 px-5 py-4 shadow-[0_20px_70px_rgba(2,6,23,0.18)]">
          <div className="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-300">La rencontre au bon moment</p>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
              Seven&apos;O
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const publicStudyCount = await getPublicStudyResponseCount();
  const studyParticipationMessage = formatParticipationMessage(publicStudyCount.totalResponses);

  return (
    <PublicSiteShell>
      <div className="space-y-12 lg:space-y-16">
        <section className="rounded-[28px] border border-cyan-400/15 bg-white/5 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.18)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200/85">
                ÉTUDE SEVEN&apos;O EN COURS
              </p>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-200">{studyParticipationMessage}</p>
            </div>
            <Link
              href="/etude"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
            >
              Participer à l’étude Seven&apos;O
            </Link>
          </div>
        </section>

        <section className="overflow-hidden rounded-[36px] border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.94))] shadow-[0_28px_100px_rgba(2,6,23,0.4)]">
          <div className="grid gap-0 lg:grid-cols-[1.12fr_0.88fr]">
            <div className="space-y-6 p-6 sm:p-8 lg:p-10 xl:p-12">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/90">RECRUTEMENT ET OBSERVATOIRE DES TALENTS</p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Le bon recrutement ne commence pas par une pile de CV. Il commence par une rencontre qui a du sens.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-slate-300">
                Seven’O prépare une nouvelle façon de faire se rencontrer les professionnels et les entreprises autour de ce qui compte vraiment : des besoins précis, des compétences mieux comprises, une disponibilité réelle et un intérêt partagé avant d’aller plus loin.
              </p>
              <p className="max-w-3xl text-lg leading-8 text-slate-300">
                <span className="font-semibold">Moins de tri. Moins de silence. Plus de rencontres au bon moment.</span>
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/comment-ca-marche"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(99,102,241,0.35)] transition hover:-translate-y-0.5 hover:brightness-110"
                >
                  Découvrir comment fonctionne Seven&apos;O
                </Link>
                <Link
                  href="/a-propos"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10"
                >
                  Découvrir la vision Seven&apos;O
                </Link>
              </div>
            </div>

            <div className="relative border-t border-white/10 p-6 lg:border-l lg:border-t-0 lg:p-8 xl:p-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.12),transparent_32%),radial-gradient(circle_at_top_left,rgba(249,115,22,0.08),transparent_24%)]" />
              <div className="relative">
                <HeroBrandComposition />
              </div>
            </div>
          </div>
        </section>

        <PageSection
          eyebrow="LE CONSTAT"
          title="Le recrutement ne manque pas de candidats. Il manque de clarté."
          description="Les candidats postulent sans savoir si leur profil sera réellement étudié. Les entreprises trient sans toujours savoir qui est disponible, motivé ou prêt à avancer. Entre les deux : beaucoup de temps perdu, peu de réponses et des rencontres qui n’arrivent pas."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_18px_60px_rgba(2,6,23,0.16)]">
              <p className="text-lg font-semibold text-white">Candidater sans retour</p>
              <p className="mt-3 text-base leading-8 text-slate-300">
                Des offres parfois déjà pourvues, des compétences réduites à quelques mots-clés et, trop souvent,
                aucune réponse pour comprendre ou avancer.
              </p>
            </article>

            <article className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_18px_60px_rgba(2,6,23,0.16)]">
              <p className="text-lg font-semibold text-white">Recruter sans visibilité</p>
              <p className="mt-3 text-base leading-8 text-slate-300">
                Des volumes de CV à parcourir, des disponibilités incertaines et des profils difficiles à comparer
                avec le besoin réel du poste.
              </p>
            </article>
          </div>

          <p className="mt-8 max-w-4xl text-lg font-semibold leading-8 text-cyan-100">
            Le problème n’est pas de trouver plus de CV. C’est de mieux comprendre qui cherche quoi, maintenant.
          </p>
        </PageSection>

        <PageSection
          eyebrow="DISPONIBLE AUJOURD’HUI, DANS 1 MOIS OU DANS 3 MOIS"
          title="Préparez votre profil dès aujourd’hui"
          description="Quelle que soit la date prévue de votre disponibilité, cinq étapes permettent de construire dès maintenant un profil professionnel clair, complet et réellement utile."
          className="bg-[linear-gradient(180deg,rgba(10,17,32,0.95),rgba(8,15,28,0.92))]"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            {availableTodaySteps.map((step, index) => (
              <div
                key={step.title}
                className={[
                  index < 3 ? 'xl:col-span-2' : '',
                  index === 3 ? 'xl:col-start-2 xl:col-span-2' : '',
                  index === 4 ? 'md:col-span-2 xl:col-start-4 xl:col-span-2' : '',
                ].join(' ')}
              >
                <NumberedStep index={index + 1} title={step.title} description={step.description} />
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Link
              href="/connexion"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(99,102,241,0.35)] transition hover:-translate-y-0.5 hover:brightness-110"
            >
              Commencer mon profil
            </Link>
          </div>
        </PageSection>

        <PageSection
          eyebrow="POUR LES RECRUTEURS"
          title="Moins de CV à trier. Plus de profils à comprendre."
          description="Seven’O prépare un parcours qui part du besoin réel du poste, évalue ce qui compte vraiment et permet d’avancer uniquement lorsque l’entreprise et le candidat souhaitent poursuivre."
          className="bg-[linear-gradient(180deg,rgba(13,14,34,0.95),rgba(8,15,28,0.92))]"
        >
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-6 xl:items-stretch">
            {recruiterSteps.map((step, index) => (
              <div key={step.title} className={step.className}>
                <NumberedStep index={index + 1} title={step.title} description={step.description} />
              </div>
            ))}
          </div>

          <p className="mt-8 text-sm font-medium text-orange-100/90">Accès entreprise actuellement sur invitation</p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/entreprises"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(99,102,241,0.35)] transition hover:-translate-y-0.5 hover:brightness-110"
            >
              Découvrir Seven’O pour les entreprises
            </Link>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10"
            >
              Demander un accès pilote
            </Link>
          </div>
        </PageSection>

        <PageSection
          eyebrow="ANONYMAT ET INTÉRÊT MUTUEL"
          title="Les identités viennent après l’intérêt, pas avant."
          description="Seven’O utilise l’anonymat pour éviter qu’un nom, une photo, une réputation ou une marque ne décide de la suite avant même que les compétences, le besoin et les conditions aient été compris."
        >
          <div className="space-y-6">
            <div className="grid gap-4 xl:grid-cols-2 xl:items-stretch">
              <article className="flex h-full rounded-[28px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(10,17,32,0.98),rgba(8,15,28,0.95))] p-5 shadow-[0_18px_60px_rgba(2,6,23,0.18)] sm:p-6">
                <div className="flex h-full flex-col items-start gap-4 text-left">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200/90">Pour le candidat</p>
                  <p className="max-w-xl text-base leading-8 text-slate-200">
                    Le candidat est d’abord découvert à travers ce qu’il sait faire, ce qu’il recherche, son expérience, sa disponibilité et ses recommandations. Son nom, ses coordonnées, sa photo et son adresse précise restent privés.
                  </p>
                </div>
              </article>

              <article className="flex h-full rounded-[28px] border border-violet-400/15 bg-[linear-gradient(180deg,rgba(13,14,34,0.98),rgba(8,15,28,0.95))] p-5 shadow-[0_18px_60px_rgba(2,6,23,0.18)] sm:p-6">
                <div className="flex h-full flex-col items-start gap-4 text-left">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-200/90">Pour l’entreprise</p>
                  <p className="max-w-xl text-base leading-8 text-slate-200">
                    L’entreprise est d’abord découverte à travers le poste proposé, les missions, les attentes, les conditions et le contexte de travail. Son identité ne prend place qu’une fois l’intérêt pour l’opportunité confirmé.
                  </p>
                </div>
              </article>
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(90deg,rgba(34,211,238,0.12),rgba(139,92,246,0.14),rgba(249,115,22,0.10))] px-5 py-4 shadow-[0_18px_60px_rgba(2,6,23,0.16)] sm:px-6">
              <div className="absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-100/90">MISE EN RELATION PROCHAINEMENT</p>
                <p className="text-sm leading-7 text-slate-200">
                  Dans le parcours complet Seven’O, lorsque les deux parties souhaiteront avancer, les identités seront révélées et la conversation pourra commencer.
                </p>
              </div>
            </div>

            <p className="max-w-4xl text-lg font-semibold leading-8 text-cyan-100 sm:text-xl">
              L’anonymat n’est pas là pour cacher. Il est là pour remettre les éléments professionnels au centre de la première décision.
            </p>
          </div>
        </PageSection>

        <PageSection
          eyebrow="OUVERTURE PROGRESSIVE"
          title="Seven’O ouvre progressivement à ses premiers utilisateurs."
          description="Les candidats peuvent dès maintenant créer leur compte, compléter leur profil professionnel et réunir leurs recommandations. Les entreprises peuvent rejoindre Seven’O sur demande et utiliser le parcours de recrutement avec un tarif préférentiel pendant la phase de lancement."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <ProgressiveLaunchStep
              index={1}
              title="Candidats : préparez votre profil"
              description="Créez votre compte, précisez votre recherche et votre disponibilité, présentez votre parcours, complétez le questionnaire Seven’O et réunissez vos recommandations professionnelles."
              href="/connexion"
              buttonLabel="Créer mon profil candidat"
              className="border-cyan-400/15 bg-[linear-gradient(180deg,rgba(10,17,32,0.98),rgba(8,15,28,0.95))]"
              accentClassName="bg-cyan-400/10 text-cyan-100"
              buttonClassName="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 text-white shadow-[0_18px_50px_rgba(99,102,241,0.35)]"
            />
            <ProgressiveLaunchStep
              index={2}
              title="Entreprises : demandez votre accès"
              description="Contactez Seven’O pour obtenir un accès entreprise de lancement, créer vos offres et commencer à rencontrer des candidats correspondant réellement à vos besoins."
              href="/contact"
              buttonLabel="Demander un accès entreprise"
              className="border-violet-400/15 bg-[linear-gradient(180deg,rgba(13,14,34,0.98),rgba(8,15,28,0.95))]"
              accentClassName="bg-violet-400/10 text-violet-100"
              buttonClassName="border border-white/10 bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/10"
            />
            <ProgressiveLaunchStep
              index={3}
              title="Un parcours de recrutement déjà opérationnel"
              description="L’entreprise définit son besoin, ajoute ses prérequis, utilise un questionnaire ciblé, étudie les candidatures puis engage la conversation après validation mutuelle."
              className="border-white/10 bg-white/5"
              accentClassName="bg-white/10 text-slate-100"
            />
            <ProgressiveLaunchStep
              index={4}
              title="Un tarif préférentiel pendant le lancement"
              description="Les premières entreprises bénéficient de conditions préférentielles en contrepartie de leurs retours, afin d’accompagner l’amélioration progressive de Seven’O."
              className="border-white/10 bg-white/5"
              accentClassName="bg-white/10 text-slate-100"
            />
          </div>
          <div className="mt-6 rounded-[24px] border border-white/10 bg-[linear-gradient(90deg,rgba(34,211,238,0.10),rgba(139,92,246,0.12),rgba(249,115,22,0.08))] px-5 py-4 text-center text-sm font-medium leading-7 text-slate-100 shadow-[0_18px_60px_rgba(2,6,23,0.16)] sm:px-6">
            Profils candidats ouverts — Accès entreprise sur demande — Mise en relation opérationnelle — Tarif de lancement préférentiel
          </div>
        </PageSection>

        <PageSection
          eyebrow="Observatoire Seven’O"
          title="Comprendre le marché pour mieux rapprocher les besoins."
          description="Seven’O ne se limite pas à la mise en relation. Son observatoire recueille les retours des professionnels et des entreprises pour identifier ce qui bloque, ce qui manque et ce qui évolue réellement dans le recrutement."
        >
          <div className="grid gap-6 xl:grid-cols-2 xl:items-stretch">
            <article className="flex h-full flex-col rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_18px_60px_rgba(2,6,23,0.18)] sm:p-7">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200/85">
                Ce que l’observatoire cherche à comprendre
              </p>
              <ol className="mt-6 border-y border-white/10">
                {observatoryFocusItems.map((item, index) => (
                  <li key={item} className="flex gap-4 border-b border-white/10 py-4 last:border-b-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/15 bg-cyan-400/10 text-sm font-semibold text-cyan-100">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-7 text-slate-200">{item}</p>
                  </li>
                ))}
              </ol>
            </article>

            <article className="flex h-full flex-col rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(13,14,34,0.96),rgba(8,15,28,0.94))] p-6 shadow-[0_18px_60px_rgba(2,6,23,0.18)] sm:p-7">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-200/85">
                L’étude Seven’O est toujours ouverte
              </p>
              <p className="mt-5 text-3xl font-semibold leading-tight text-cyan-100 sm:text-4xl">
                {studyParticipationMessage}
              </p>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Chaque réponse nous aide à construire une plateforme plus proche des besoins réels du marché, sans mélanger les résultats de l’étude avec les profils ou les recrutements réalisés sur Seven’O.
              </p>
              <div className="mt-auto pt-6">
                <Link
                  href="/etude"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(99,102,241,0.35)] transition hover:-translate-y-0.5 hover:brightness-110"
                >
                  Participer à l’étude Seven’O
                </Link>
              </div>
            </article>
          </div>
        </PageSection>

        <section className="rounded-[36px] border border-cyan-400/12 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),rgba(8,15,28,0.94)_45%)] p-6 shadow-[0_24px_90px_rgba(2,6,23,0.34)] sm:p-8 lg:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">
            REJOIGNEZ L’OUVERTURE PROGRESSIVE
          </p>
          <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Le recrutement avance lorsque les deux côtés sont prêts.
          </h2>
          <p className="mt-5 max-w-4xl text-base leading-8 text-slate-300 sm:text-lg">
            Candidats, créez votre profil, précisez votre disponibilité et réunissez vos recommandations. Entreprises, demandez votre accès de lancement pour publier vos besoins et utiliser le parcours Seven’O dans des conditions préférentielles.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/connexion"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(99,102,241,0.35)] transition hover:-translate-y-0.5 hover:brightness-110"
            >
              Créer mon profil candidat
            </Link>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10"
            >
              Demander un accès entreprise
            </Link>
          </div>
        </section>

        <HomeFaqSection />
      </div>
    </PublicSiteShell>
  );
}
