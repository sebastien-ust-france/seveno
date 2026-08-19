import Link from 'next/link';
import { CompanySection } from '@/components/public/companies/CompanySection';

export function CompanyPricingPreview() {
  return (
    <CompanySection
      eyebrow="TARIFS ENTREPRISES"
      title="Des tarifs simples, sans abonnement"
      description="Activez une campagne de recrutement à partir de 390 € HT. Des packs sont disponibles pour les entreprises qui recrutent plusieurs fois."
    >
      <Link
        href="/entreprises/tarifs"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-seveno-brand-blue/40 bg-seveno-brand-blue/10 px-6 py-3 text-center text-sm font-semibold text-seveno-text-primary transition hover:border-seveno-brand-blue/65 hover:bg-seveno-brand-blue/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seveno-border-focus sm:w-auto"
      >
        Découvrir les tarifs
      </Link>
    </CompanySection>
  );
}
