import CandidateApplicationDetail from '@/components/candidate/CandidateApplicationDetail';

type PageProps = { params: Promise<{ applicationId: string }> };

export default async function CandidateApplicationPage({ params }: PageProps) {
  const { applicationId } = await params;
  return <CandidateApplicationDetail applicationId={applicationId} />;
}
