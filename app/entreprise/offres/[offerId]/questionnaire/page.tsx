import CompanyQuestionnaireEditor from '@/components/entreprise/CompanyQuestionnaireEditor';

type PageProps = { params: Promise<{ offerId: string }> };

export default async function CompanyOfferQuestionnairePage({ params }: PageProps) {
  const { offerId } = await params;
  return <CompanyQuestionnaireEditor offerId={offerId} />;
}
