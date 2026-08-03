import CandidateOfferDetail from '@/components/candidate/CandidateOfferDetail';

type PageProps = { params: Promise<{ offerId: string }> };

export default async function CandidateOfferPage({ params }: PageProps) {
  const { offerId } = await params;

  return <CandidateOfferDetail offerId={offerId} />;
}
