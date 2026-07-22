import type { Metadata } from 'next';
import { ContactFaq } from '@/components/public/contact/ContactFaq';
import { ContactForm } from '@/components/public/contact/ContactForm';
import { ContactHero } from '@/components/public/contact/ContactHero';
import { ContactInformation } from '@/components/public/contact/ContactInformation';
import { PublicSiteShell } from '@/components/public/PublicSiteShell';
import { resolveContactReasonCode } from '@/lib/seveno-contact';

type ContactPageProps = {
  searchParams?: Promise<{
    motif?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "Seven’O - Contact",
  alternates: {
    canonical: '/contact',
  },
  description:
    "Contactez Seven’O pour une assistance candidat, un accès entreprise, une recommandation professionnelle ou une demande liée aux données.",
};

function getInitialReason(searchParams: Awaited<ContactPageProps['searchParams']>) {
  const motif = Array.isArray(searchParams?.motif) ? searchParams.motif[0] : searchParams?.motif;
  return resolveContactReasonCode(motif) ?? '';
}

export default async function ContactPublicPage({ searchParams }: ContactPageProps) {
  const initialReason = getInitialReason(await searchParams);

  return (
    <PublicSiteShell>
      <div className="space-y-10">
        <ContactHero />

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] lg:items-start">
          <ContactForm initialReason={initialReason} />
          <ContactInformation />
        </section>

        <ContactFaq />
      </div>
    </PublicSiteShell>
  );
}
