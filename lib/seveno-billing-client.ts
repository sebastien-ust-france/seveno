'use client';

import type { User } from 'firebase/auth';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import type { BillingOrderStatusView, CompanyBillingView, CompanyContextView, CompanyMembershipRole, CompanyMembershipView, RecruitmentDashboardView } from '@/types/seveno-billing';
import type { BillingProductCode } from '@/types/seveno-billing';

export const ACTIVE_COMPANY_STORAGE_KEY = 'seveno_active_company_id';
export function companyHeaders() {
  const companyId = typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY) : null;
  return companyId ? { 'x-seveno-company-id': companyId } : undefined;
}
export function getCompanyContextClient(user: User) {
  return fetchSevenoMatchApi<CompanyContextView>(user, '/api/seveno/company-context', { headers: companyHeaders() });
}
export function getCompanyBillingClient(user: User) {
  return fetchSevenoMatchApi<CompanyBillingView>(user, '/api/seveno/billing', { headers: companyHeaders() });
}
export function getRecruitmentDashboardClient(user: User) {
  return fetchSevenoMatchApi<RecruitmentDashboardView>(user, '/api/seveno/recruitment-dashboard', { headers: companyHeaders() });
}
export function createStripeCheckoutClient(user: User, input: { productCode: BillingProductCode; campaignId?: string; requestId: string }) {
  return fetchSevenoMatchApi<{ orderId: string; checkoutSessionId: string; checkoutUrl: string }>(user, '/api/seveno/billing/checkout', { method: 'POST', headers: companyHeaders(), body: JSON.stringify(input) });
}
export function acceptCompanySalesTermsClient(user: User) {
  return fetchSevenoMatchApi<{ termsType: 'company_sales_terms'; version: '1.0'; acceptedAt: string }>(user, '/api/seveno/billing/terms', {
    method: 'POST', headers: companyHeaders(), body: '{}',
  });
}
export function getBillingOrderStatusClient(user: User, orderId: string, signal?: AbortSignal) {
  return fetchSevenoMatchApi<BillingOrderStatusView>(user, `/api/seveno/billing/orders/${encodeURIComponent(orderId)}`, { headers: companyHeaders(), signal });
}
export function getCompanyMembersClient(user: User) {
  return fetchSevenoMatchApi<{ members: CompanyMembershipView[] }>(user, '/api/seveno/company-memberships', { headers: companyHeaders() });
}

export function createCompanyMemberInvitationClient(user: User, input: { email: string; role: CompanyMembershipRole; canPurchaseCredits?: boolean }) {
  return fetchSevenoMatchApi<{ invitationUrl: string; expiresAt: string; emailSent: boolean; emailFailureReason?: string }>(user, '/api/seveno/company-member-invitations', {
    method: 'POST', headers: companyHeaders(), body: JSON.stringify(input),
  });
}

export function mutateCompanyMembershipClient(user: User, input:
  | { membershipId: string; action: 'update'; displayName: string; role: Exclude<CompanyMembershipRole, 'owner'>; canPurchaseCredits?: boolean }
  | { membershipId: string; action: 'suspend' | 'reactivate' | 'remove' }) {
  return fetchSevenoMatchApi<{ updated: true }>(user, '/api/seveno/company-memberships', {
    method: 'PATCH', headers: companyHeaders(), body: JSON.stringify(input),
  });
}
