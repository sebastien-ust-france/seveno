import type { CompanyMembershipRole } from '@/types/seveno-billing';

export function recruitmentCreditPresentation(availableCredits: number, role: CompanyMembershipRole, canPurchaseCredits: boolean) {
  const credits = Math.max(0, Math.trunc(availableCredits));
  const canBuy = (role === 'owner' || role === 'admin') && canPurchaseCredits;
  if (credits === 0) return {
    credits, state: 'empty' as const, label: 'Aucun crédit disponible',
    message: 'Une nouvelle campagne ne pourra pas être activée tant que l’entreprise n’aura pas acheté de crédits.', canBuy,
  };
  if (credits <= 2) return {
    credits, state: 'low' as const, label: 'Stock faible',
    message: canBuy ? 'Pensez à anticiper l’achat de nouveaux crédits.' : 'Pensez à prévenir le propriétaire ou un responsable de la facturation.', canBuy,
  };
  return { credits, state: 'normal' as const, label: null, message: '1 crédit permet d’activer une nouvelle campagne.', canBuy };
}
