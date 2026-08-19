'use client';

import { useEffect, useState } from 'react';
import { getCurrentAuthUser } from '@/lib/auth';
import { ACTIVE_COMPANY_STORAGE_KEY, getCompanyContextClient } from '@/lib/seveno-billing-client';
import { COMPANY_ROLE_PRESENTATION } from '@/lib/seveno-company-roles';
import type { CompanyContextView } from '@/types/seveno-billing';

export function CompanyContextSelector() {
  const [context, setContext] = useState<CompanyContextView | null>(null);
  useEffect(() => {
    let mounted = true;
    getCurrentAuthUser().then((user) => user ? getCompanyContextClient(user) : null).then((value) => {
      if (mounted && value) setContext(value);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);
  if (!context || context.companies.length < 2) return null;
  return (
    <label className="mb-4 block rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
      <span className="mr-3">Entreprise active</span>
      <select
        value={context.activeCompanyId}
        onChange={(event) => {
          window.localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, event.target.value);
          window.location.reload();
        }}
        className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
      >
        {context.companies.map((company) => <option key={company.companyId} value={company.companyId}>{company.companyName} — {COMPANY_ROLE_PRESENTATION[company.role].label}</option>)}
      </select>
    </label>
  );
}
