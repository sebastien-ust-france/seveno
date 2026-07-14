import JobOfferEditor from '@/components/entreprise/JobOfferEditor';

type PageProps = { params: Promise<{ offerId: string }> };

export default async function EditCompanyOfferPage({ params }: PageProps) {
  const { offerId } = await params;
  return <JobOfferEditor offerId={offerId} />;
}
