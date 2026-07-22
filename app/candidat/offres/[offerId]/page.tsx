import { CandidateFeatureComingSoon } from '@/components/candidate/CandidateFeatureComingSoon';

type PageProps = { params: Promise<{ offerId: string }> };

export default async function CandidateOfferPage({ params }: PageProps) {
  const { offerId } = await params;

  return (
    <CandidateFeatureComingSoon
      title="Détail de l’offre"
      description={`Le détail de l’offre ${offerId} sera disponible lors du lancement complet de Seven’O.`}
      backLabel="Retour aux offres"
      backHref="/candidat/offres"
    />
  );
}
