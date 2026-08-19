import type { Metadata } from 'next';
import Link from 'next/link';
import { CompanySection } from '@/components/public/companies/CompanySection';
import { PublicSiteShell } from '@/components/public/PublicSiteShell';

export const metadata: Metadata = {
  title: 'Tarifs entreprises | Seven’O',
  description: 'Découvrez les tarifs de lancement Seven’O pour recruter sur les compétences, sans abonnement ni commission sur l’embauche.',
  alternates: {
    canonical: '/entreprises/tarifs',
  },
};

const creditOffers = [
  { title: '1 crédit recrutement', price: '390 € HT', description: 'Une campagne de recrutement Seven’O.' },
  { title: 'Pack 3 crédits', price: '990 € HT', description: 'Trois campagnes de recrutement Seven’O.' },
  { title: 'Pack 10 crédits', price: '2 990 € HT', description: 'Dix campagnes de recrutement Seven’O.' },
] as const;

const campaignFeatures = [
  'Une campagne active pendant 60 jours',
  'Jusqu’à 20 candidatures qualifiées',
  'Jusqu’à 5 dossiers simultanément en attente d’une décision de l’entreprise',
  'La libération d’une place dès que l’entreprise enregistre sa décision',
  'Les questionnaires Seven’O',
  'Le matching avec les candidats compatibles',
  'Les notifications ciblées',
  'Les résultats des questionnaires',
  'La mise en relation',
  'La conversation sécurisée',
  'Le partage volontaire et indépendant des coordonnées',
] as const;

const options = [
  {
    title: 'Prolongation de 30 jours',
    price: '90 € HT',
    description: 'Ajoute 30 jours à une campagne existante, sans modifier sa capacité de candidatures.',
  },
  {
    title: 'Extension de capacité de campagne',
    price: '190 € HT',
    description: 'Permet de traiter jusqu’à 10 dossiers qualifiés supplémentaires dans la même campagne.',
  },
] as const;

function PriceCard({ title, price, description }: { title: string; price: string; description: string }) {
  return (
    <article className="flex h-full min-w-0 flex-col rounded-[26px] border border-seveno-border-subtle bg-seveno-surface-panel p-5 sm:p-6">
      <h3 className="text-xl font-semibold text-seveno-text-primary">{title}</h3>
      <p className="mt-5 text-3xl font-semibold tracking-tight text-seveno-brand-cyan-soft sm:text-4xl" aria-label={price}>
        {price}
      </p>
      <p className="mt-4 text-base leading-7 text-seveno-text-secondary">{description}</p>
    </article>
  );
}

export default function CompanyPricingPage() {
  return (
    <PublicSiteShell>
      <div className="space-y-12 lg:space-y-16">
        <section className="overflow-hidden rounded-[36px] border border-seveno-border-active/40 bg-gradient-to-br from-seveno-surface-section via-seveno-surface-panel to-seveno-surface-page p-6 shadow-2xl sm:p-8 lg:p-10 xl:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-seveno-brand-cyan">TARIFS ENTREPRISES</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-seveno-text-primary sm:text-5xl lg:text-6xl">Tarifs de lancement Seven’O</h1>
          <p className="mt-5 max-w-4xl text-lg leading-8 text-seveno-text-secondary">Des tarifs transparents pour recruter sur les compétences, sans abonnement et sans commission sur l’embauche.</p>
          <p className="mt-6 text-base font-semibold leading-7 text-seveno-brand-cyan-soft">Aucun abonnement. Aucune commission sur l’embauche. Aucun renouvellement automatique.</p>
          <p className="mt-3 text-sm leading-6 text-seveno-text-muted">Les prix sont exprimés hors taxes.</p>
        </section>

        <CompanySection eyebrow="CRÉDITS DE RECRUTEMENT" title="Choisissez le volume adapté à vos recrutements.">
          <div className="grid gap-5 md:grid-cols-3">
            {creditOffers.map((offer) => <PriceCard key={offer.title} {...offer} />)}
          </div>
        </CompanySection>

        <CompanySection eyebrow="UNE CAMPAGNE SEVEN’O" title="Ce que comprend un crédit">
          <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
            {campaignFeatures.map((feature) => (
              <li key={feature} className="flex gap-3 text-base leading-7 text-seveno-text-secondary">
                <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-seveno-brand-cyan" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <p className="rounded-[22px] border border-seveno-brand-blue/30 bg-seveno-surface-active px-5 py-4 text-base font-semibold leading-7 text-seveno-text-primary sm:px-6">
            Pour garantir un traitement sérieux des candidatures, une entreprise peut examiner jusqu’à cinq dossiers simultanément. Une nouvelle place se libère dès qu’une décision est enregistrée.
          </p>
        </CompanySection>

        <CompanySection eyebrow="OPTIONS COMPLÉMENTAIRES" title="Faites évoluer une campagne existante.">
          <div className="grid gap-5 md:grid-cols-2">
            {options.map((option) => <PriceCard key={option.title} {...option} />)}
          </div>
        </CompanySection>

        <section className="rounded-[34px] border border-seveno-brand-cyan/25 bg-seveno-surface-section p-6 shadow-2xl sm:p-8 lg:p-10">
          <h2 className="text-3xl font-semibold tracking-tight text-seveno-text-primary sm:text-4xl">Seven’O reste gratuit pour les candidats</h2>
          <div className="mt-5 max-w-4xl space-y-3 text-lg leading-8 text-seveno-text-secondary">
            <p>Les entreprises financent l’utilisation des outils de recrutement. Elles n’achètent ni une candidature ni l’accès automatique aux données personnelles des candidats.</p>
            <p>Chaque candidat reste libre de partager ou non ses propres coordonnées après l’ouverture de la mise en relation.</p>
          </div>
        </section>

        <section className="rounded-[34px] border border-seveno-brand-blue/25 bg-gradient-to-br from-seveno-surface-section via-seveno-surface-panel to-seveno-surface-page p-6 text-center shadow-2xl sm:p-8 lg:p-10">
          <h2 className="text-3xl font-semibold tracking-tight text-seveno-text-primary sm:text-4xl">Préparez votre prochaine campagne avec Seven’O.</h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-seveno-text-secondary">Présentez votre besoin de recrutement et découvrez le parcours entreprise.</p>
          <Link href="/contact" className="mt-7 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-seveno-action-primary px-6 py-3 text-center text-sm font-semibold text-seveno-text-on-accent transition hover:bg-seveno-action-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus sm:w-auto">Demander un accès entreprise</Link>
        </section>

        <p className="mx-auto max-w-4xl text-center text-sm leading-6 text-seveno-text-muted">Les tarifs de lancement peuvent évoluer pour les futurs achats. Les crédits déjà achetés conservent les conditions applicables au moment de leur acquisition.</p>
      </div>
    </PublicSiteShell>
  );
}
