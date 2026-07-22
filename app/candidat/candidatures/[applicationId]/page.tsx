import { CandidateFeatureComingSoon } from '@/components/candidate/CandidateFeatureComingSoon';

type PageProps = { params: Promise<{ applicationId: string }> };

export default async function CandidateApplicationPage({ params }: PageProps) {
  const { applicationId } = await params;

  return (
    <CandidateFeatureComingSoon
      title="Détail de la candidature"
      description={`Le détail de la candidature ${applicationId} sera disponible lors du lancement complet de Seven’O.`}
      backLabel="Retour aux candidatures"
      backHref="/candidat/candidatures"
    />
  );
}
