export const MAX_ACTIVE_CANDIDATE_FILES_PER_OFFER = 5;

export function buildOfferCapacityReminderMessage(activeCount: number) {
  if (activeCount >= MAX_ACTIVE_CANDIDATE_FILES_PER_OFFER) {
    return 'Vos 5 candidatures sont actuellement en cours de traitement. Finalisez une décision pour pouvoir engager un nouveau candidat.';
  }

  if (activeCount >= MAX_ACTIVE_CANDIDATE_FILES_PER_OFFER - 1) {
    return 'Pensez à finaliser vos décisions pour continuer à engager de nouveaux candidats.';
  }

  return null;
}

export function buildOfferCapacityLabel(activeCount: number) {
  return `${activeCount} candidatures à traiter sur ${MAX_ACTIVE_CANDIDATE_FILES_PER_OFFER}`;
}

export function isOfferAtCapacity(activeCount: number) {
  return activeCount >= MAX_ACTIVE_CANDIDATE_FILES_PER_OFFER;
}
