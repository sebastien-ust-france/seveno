import type { Metadata } from 'next';
import { CompanyAfterEvaluation } from '@/components/public/companies/CompanyAfterEvaluation';
import { CompanyEvaluationConsequences } from '@/components/public/companies/CompanyEvaluationConsequences';
import { CompanyFaq } from '@/components/public/companies/CompanyFaq';
import { CompanyPublicHero } from '@/components/public/companies/CompanyPublicHero';
import { CompanyPricingPreview } from '@/components/public/companies/CompanyPricingPreview';
import { CompanyQuestionnaireCreation } from '@/components/public/companies/CompanyQuestionnaireCreation';
import { CompanyQuestionnaireDifference } from '@/components/public/companies/CompanyQuestionnaireDifference';
import { CompanyRecruitmentFinding } from '@/components/public/companies/CompanyRecruitmentFinding';
import { CompanyTradeEngine } from '@/components/public/companies/CompanyTradeEngine';
import { CompanyValueConclusion } from '@/components/public/companies/CompanyValueConclusion';
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
        <CompanyRecruitmentFinding />
        <CompanyEvaluationConsequences />
        <CompanyTradeEngine />
        <CompanyQuestionnaireDifference />
        <CompanyQuestionnaireCreation />
        <CompanyAfterEvaluation />
        <CompanyPricingPreview />
        <CompanyValueConclusion />
        <CompanyFaq />
      </div>
    </PublicSiteShell>
  );
}
