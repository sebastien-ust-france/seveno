import CandidateApplicationQuestionnaire from '@/components/candidate/CandidateApplicationQuestionnaire';

type PageProps = { params: Promise<{ applicationId: string }> };

export default async function CandidateApplicationQuestionnairePage({ params }: PageProps) {
  const { applicationId } = await params;
  return <CandidateApplicationQuestionnaire applicationId={applicationId} />;
}
