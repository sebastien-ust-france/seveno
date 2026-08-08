import type { CompanyMembershipPermissions, CompanyMembershipRole } from '@/types/seveno-billing';

export const COMPANY_ROLE_PRESENTATION: Record<CompanyMembershipRole, { label: string; description: string; detail?: string }> = {
  owner: { label: 'Propriétaire', description: 'Accès complet à l’entreprise, aux recrutements, aux membres, aux crédits et à la facturation.' },
  admin: { label: 'Administrateur', description: 'Gère les recrutements, les membres et l’administration courante de l’entreprise.', detail: 'Recommandé pour les petites structures lorsqu’une même personne gère les recrutements et l’administration. Le propriétaire peut autoriser ou bloquer séparément l’achat de crédits.' },
  recruiter: { label: 'Recruteur', description: 'Gère les offres, les candidatures, les questionnaires et les mises en relation.' },
  billing_manager: { label: 'Responsable facturation', description: 'Consulte le solde et l’historique et peut acheter des crédits pour l’entreprise.' },
  viewer: { label: 'Consultation uniquement', description: 'Peut consulter les informations autorisées sans effectuer de modification.' },
};

export function canPurchaseCompanyCredits(membership: { role: CompanyMembershipRole; permissions?: Partial<CompanyMembershipPermissions> | null }) {
  if (membership.role === 'owner' || membership.role === 'billing_manager') return true;
  if (membership.role === 'admin') return membership.permissions?.canPurchaseCredits !== false;
  return false;
}

export function permissionsForRole(role: CompanyMembershipRole, adminCanPurchaseCredits = true): CompanyMembershipPermissions {
  return { canPurchaseCredits: role === 'owner' || role === 'billing_manager' || (role === 'admin' && adminCanPurchaseCredits) };
}
