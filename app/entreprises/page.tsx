import type { Metadata } from 'next';
import { CompanyCandidateQuestionnaire } from '@/components/public/companies/CompanyCandidateQuestionnaire';
import { CompanyFaq } from '@/components/public/companies/CompanyFaq';
import { CompanyLaunchCta } from '@/components/public/companies/CompanyLaunchCta';
import { CompanyPublicHero } from '@/components/public/companies/CompanyPublicHero';
import { CompanyQuestionnaireControl } from '@/components/public/companies/CompanyQuestionnaireControl';
import { CompanyQuestionnaireCreation } from '@/components/public/companies/CompanyQuestionnaireCreation';
import { CompanyQuestionnaireDifference } from '@/components/public/companies/CompanyQuestionnaireDifference';
import { CompanyRecruitmentJourney } from '@/components/public/companies/CompanyRecruitmentJourney';
import { CompanyThresholdSection } from '@/components/public/companies/CompanyThresholdSection';
import { PublicSiteShell } from '@/components/public/PublicSiteShell';

export const metadata: Metadata = {
  title: "Seven’O - Entreprises",
  alternates: {
    canonical: '/entreprises',
  },
  description:
    "Présentation publique de Seven’O pour les entreprises : questionnaires, seuil de réussite, parcours recruteur et accès sur demande.",
};

export default function EnterprisesPublicPage() {
  return (
    <PublicSiteShell>
      <div className="space-y-12 lg:space-y-16">
        <CompanyPublicHero />
        <CompanyQuestionnaireDifference />
        <CompanyQuestionnaireCreation />
        <CompanyQuestionnaireControl />
        <CompanyCandidateQuestionnaire />
        <CompanyThresholdSection />
        <CompanyRecruitmentJourney />
        <CompanyLaunchCta />
        <CompanyFaq />
      </div>
    </PublicSiteShell>
  );
}
