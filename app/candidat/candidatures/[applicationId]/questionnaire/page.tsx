import { CandidateFeatureComingSoon } from '@/components/candidate/CandidateFeatureComingSoon';

type PageProps = { params: Promise<{ applicationId: string }> };

export default async function CandidateApplicationQuestionnairePage({ params }: PageProps) {
  const { applicationId } = await params;

  return (
    <CandidateFeatureComingSoon
      title="Questionnaire associé"
      description={`Le questionnaire lié à la candidature ${applicationId} sera ouvert lors du lancement complet de Seven’O.`}
      backLabel="Retour à la candidature"
      backHref={`/candidat/candidatures/${applicationId}`}
    />
  );
}
