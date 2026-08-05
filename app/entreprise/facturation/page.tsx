'use client';

import { useEffect, useState } from 'react';
import { useSevenoCompanySession } from '@/lib/use-seveno-company-session';
import { getCompanyBillingClient } from '@/lib/seveno-billing-client';
import type { CompanyBillingView } from '@/types/seveno-billing';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';

function euros(cents: number) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100); }

export default function CompanyBillingPage() {
  const { authUser, loading: sessionLoading, error: sessionError } = useSevenoCompanySession();
  const [billing, setBilling] = useState<CompanyBillingView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!authUser) return;
    getCompanyBillingClient(authUser).then(setBilling).catch((reason) => setError(reason instanceof Error ? reason.message : 'Facturation indisponible.'));
  }, [authUser]);
  if (sessionLoading) return <SevenoSurface eyebrow="Entreprise" title="Facturation" description="Chargement de votre compte."><p className="text-slate-300">Chargement...</p></SevenoSurface>;
  if (sessionError || error) return <SevenoSurface eyebrow="Entreprise" title="Facturation" description="Le compte de facturation n'est pas disponible."><p className="text-orange-100">{sessionError ?? error}</p></SevenoSurface>;
  return (
    <SevenoSurface eyebrow="Entreprise" title="Facturation et crédits" description="Consultez les crédits et les mouvements du compte.">
      <h1 className="text-3xl font-semibold text-white">Facturation et crédits</h1>
      <p className="mt-3 text-slate-300">Aucun abonnement. Aucune commission sur l’embauche. Aucun renouvellement automatique.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <SevenoPanel className="p-5"><p className="text-sm text-slate-300">Crédits disponibles</p><p className="mt-2 text-4xl font-semibold text-white">{billing?.availableCredits ?? 0}</p></SevenoPanel>
        <SevenoPanel className="p-5"><p className="text-sm text-slate-300">Campagnes actives</p><p className="mt-2 text-4xl font-semibold text-white">{billing?.activeCampaignCount ?? 0}</p></SevenoPanel>
      </div>
      <h2 className="mt-8 text-2xl font-semibold text-white">Tarifs de lancement</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {billing ? Object.entries(billing.products).map(([code, product]) => (
          <SevenoPanel key={code} className="p-5">
            <p className="font-semibold text-white">{product.displayName}</p><p className="mt-2 text-cyan-100">{euros(product.unitAmountExcludingTax)} HT</p>
            <button type="button" disabled className="mt-4 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-400">Paiement bientôt disponible</button>
          </SevenoPanel>
        )) : null}
      </div>
      <h2 className="mt-8 text-2xl font-semibold text-white">Historique des mouvements</h2>
      <SevenoPanel className="mt-4 overflow-x-auto p-5">
        {billing?.ledger.length ? <table className="w-full text-left text-sm text-slate-200"><thead><tr><th>Date</th><th>Opération</th><th>Mouvement</th><th>Solde</th></tr></thead><tbody>{billing.ledger.map((entry) => <tr key={entry.entryId} className="border-t border-white/10"><td className="py-3">{new Date(entry.createdAt).toLocaleDateString('fr-FR')}</td><td>{entry.type}</td><td>{entry.quantity > 0 ? '+' : ''}{entry.quantity}</td><td>{entry.balanceAfter}</td></tr>)}</tbody></table> : <p className="text-slate-300">Aucun mouvement.</p>}
      </SevenoPanel>
      <h2 className="mt-8 text-2xl font-semibold text-white">Campagnes</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">{billing?.campaigns.map((campaign) => <SevenoPanel key={campaign.campaignId}><p className="font-semibold text-white">Offre {campaign.offerId}</p><p className="mt-2 text-slate-300">{campaign.status} · fin le {new Date(campaign.endsAt).toLocaleDateString('fr-FR')}</p><p className="mt-2 text-slate-200">Candidatures qualifiées : {campaign.deliveredCandidateCount + campaign.queuedCandidateCount} / {campaign.effectiveQualifiedCandidateLimit}</p><p className="text-slate-200">Dossiers actifs : {campaign.activeCandidateCount} / {campaign.simultaneousCandidateLimit} · file : {campaign.queuedCandidateCount}</p></SevenoPanel>)}</div>
    </SevenoSurface>
  );
}
