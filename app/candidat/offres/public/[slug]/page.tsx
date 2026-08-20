import { CandidatePublicOfferRedirect } from '@/components/candidate/CandidatePublicOfferRedirect';

type PageProps = { params: Promise<{ slug: string }> };

export default async function CandidatePublicOfferPage({ params }: PageProps) {
  const { slug } = await params;
  return <CandidatePublicOfferRedirect slug={slug} />;
}
