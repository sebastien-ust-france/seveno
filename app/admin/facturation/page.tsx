'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { fetchSevenoAdminApi } from '@/lib/seveno-admin-api';
import type { BillingProductCode } from '@/types/seveno-billing';

type Payload = {
  accounts: Array<{ id: string; companyName: string; availableCredits: number; activeCampaignCount: number }>;
  campaigns: Array<{ id: string; companyId: string; offerId: string; status: string; activeCandidateCount: number; deliveredCandidateCount: number; queuedCandidateCount: number; endsAt: string }>;
  orders: Array<{ id: string; companyId: string; productCode: string; status: string; entitlementApplied: boolean }>;
};
const products: BillingProductCode[] = ['campaign_credit_1_launch', 'campaign_credit_3_launch', 'campaign_credit_10_launch', 'campaign_extension_30d_launch', 'qualified_candidates_10_launch'];

export default function AdminBillingPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [companyId, setCompanyId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [productCode, setProductCode] = useState<BillingProductCode>('campaign_credit_1_launch');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = () => fetchSevenoAdminApi<Payload>('/api/admin/billing/orders').then(setData);
  useEffect(() => { load().catch((value) => setError(value instanceof Error ? value.message : 'Facturation indisponible.')); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    try {
      await fetchSevenoAdminApi('/api/admin/billing/orders', { method: 'POST', body: JSON.stringify({ companyId, productCode, ...(campaignId ? { campaignId } : {}), reason, idempotencyKey: crypto.randomUUID() }) });
      setReason(''); await load();
    } catch (value) { setError(value instanceof Error ? value.message : 'Opération refusée.'); }
  }
  return <SevenoSurface eyebrow="Administration Seven’O" title="Facturation" description="Portefeuilles, campagnes et opérations manuelles traçables." containerClassName="max-w-7xl">
    {error ? <SevenoPanel tone="orange">{error}</SevenoPanel> : null}
    <SevenoPanel className="mb-6"><form onSubmit={submit} className="grid gap-3 md:grid-cols-2"><input required value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="companyId" className="rounded-xl bg-slate-950 p-3"/><select value={productCode} onChange={(e) => setProductCode(e.target.value as BillingProductCode)} className="rounded-xl bg-slate-950 p-3">{products.map((code) => <option key={code}>{code}</option>)}</select><input value={campaignId} onChange={(e) => setCampaignId(e.target.value)} placeholder="campaignId pour extension/capacité" className="rounded-xl bg-slate-950 p-3"/><input required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif obligatoire" className="rounded-xl bg-slate-950 p-3"/><button className="rounded-full bg-cyan-500 px-4 py-3 font-semibold text-slate-950">Appliquer l’opération manuelle</button></form></SevenoPanel>
    <div className="grid gap-6 xl:grid-cols-2"><SevenoPanel><h2 className="text-xl font-semibold">Portefeuilles</h2>{data?.accounts.map((a) => <div key={a.id} className="mt-3 border-t border-white/10 pt-3"><b>{a.companyName || a.id}</b><p>{a.availableCredits} crédit(s) · {a.activeCampaignCount} campagne(s)</p></div>)}</SevenoPanel><SevenoPanel><h2 className="text-xl font-semibold">Campagnes</h2>{data?.campaigns.map((c) => <div key={c.id} className="mt-3 border-t border-white/10 pt-3"><b>{c.id}</b><p>{c.status} · actifs {c.activeCandidateCount} · livrés {c.deliveredCandidateCount} · file {c.queuedCandidateCount}</p></div>)}</SevenoPanel></div>
  </SevenoSurface>;
}
