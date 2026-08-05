'use client';

import type { User } from 'firebase/auth';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import type { CompanyBillingView, CompanyContextView, CompanyMembershipView } from '@/types/seveno-billing';

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
export function getCompanyMembersClient(user: User) {
  return fetchSevenoMatchApi<{ members: CompanyMembershipView[] }>(user, '/api/seveno/company-memberships', { headers: companyHeaders() });
}
