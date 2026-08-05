export type CompanyMembershipRole = 'owner' | 'admin' | 'recruiter' | 'billing_manager' | 'viewer';
export type CompanyMembershipStatus = 'active' | 'invited' | 'suspended' | 'removed';
export type BillingProductCode = 'campaign_credit_1_launch' | 'campaign_credit_3_launch' | 'campaign_credit_10_launch'
  | 'campaign_extension_30d_launch' | 'qualified_candidates_10_launch';
export type CreditLedgerType = 'purchase' | 'admin_grant' | 'campaign_activation' | 'admin_restoration' | 'admin_correction';
export type BillingActorType = 'company_member' | 'seveno_admin' | 'system';
export type RecruitmentCampaignStatus = 'active' | 'paused' | 'expired' | 'candidate_limit_reached' | 'closed';
export type CandidateDeliveryStatus = 'queued' | 'delivered' | 'slot_released' | 'cancelled';

export interface CompanyMembershipView {
  membershipId: string;
  companyId: string;
  userUid: string;
  role: CompanyMembershipRole;
  status: CompanyMembershipStatus;
  displayName: string | null;
  email: string | null;
  joinedAt: string | null;
  createdAt: string;
}

export interface CompanyContextView {
  activeCompanyId: string;
  activeProfile: import('@/types/seveno').CompanyProfile;
  companies: Array<{ companyId: string; companyName: string; role: CompanyMembershipRole }>;
}

export interface BillingCatalogProduct {
  type: 'credit_pack' | 'campaign_extension' | 'candidate_capacity';
  displayName: string;
  unitAmountExcludingTax: number;
  active: boolean;
  creditQuantity?: number;
  extensionDays?: number;
  candidateCapacityIncrement?: number;
}

export interface CompanyBillingView {
  companyId: string;
  availableCredits: number;
  lifetimeGrantedCredits: number;
  lifetimePurchasedCredits: number;
  lifetimeConsumedCredits: number;
  lifetimeRestoredCredits: number;
  activeCampaignCount: number;
  catalogVersion: 'launch_v1';
  products: Record<BillingProductCode, BillingCatalogProduct>;
  campaigns: RecruitmentCampaignView[];
  ledger: Array<{
    entryId: string; type: CreditLedgerType; quantity: number; balanceAfter: number;
    actorUid: string | null; offerId?: string; campaignId?: string; reason?: string; createdAt: string;
  }>;
}

export interface RecruitmentCampaignView {
  campaignId: string;
  companyId: string;
  offerId: string;
  status: RecruitmentCampaignStatus;
  startedAt: string;
  endsAt: string;
  baseDurationDays: 60;
  purchasedExtensionDays: number;
  simultaneousCandidateLimit: 5;
  baseQualifiedCandidateLimit: 20;
  purchasedQualifiedCandidateCapacity: number;
  effectiveQualifiedCandidateLimit: number;
  activeCandidateCount: number;
  deliveredCandidateCount: number;
  queuedCandidateCount: number;
}
