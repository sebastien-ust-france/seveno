import type { Metadata } from 'next';
import { PublicSiteShell } from '@/components/public/PublicSiteShell';
import { CandidateAnonymityIntro } from '@/components/public/candidates/CandidateAnonymityIntro';
import { CandidateControlSection } from '@/components/public/candidates/CandidateControlSection';
import { CandidateFaq } from '@/components/public/candidates/CandidateFaq';
import { CandidateJourney } from '@/components/public/candidates/CandidateJourney';
import { CandidateLaunchCta } from '@/components/public/candidates/CandidateLaunchCta';
import { CandidatePublicHero } from '@/components/public/candidates/CandidatePublicHero';

export const metadata: Metadata = {
  title: "Seven'O - Candidats",
  alternates: {
    canonical: '/candidats',
  },
  description:
    "Découvrez le parcours candidat Seven’O, l’anonymat professionnel, la progression des étapes et les réponses aux questions fréquentes.",
};

export default function CandidatesPublicPage() {
  return (
    <PublicSiteShell>
      <div className="space-y-12 lg:space-y-16">
        <CandidatePublicHero />
        <CandidateAnonymityIntro />
        <CandidateJourney />
        <CandidateControlSection />
        <CandidateLaunchCta />
        <CandidateFaq />
      </div>
    </PublicSiteShell>
  );
}
