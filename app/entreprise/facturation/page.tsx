'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSevenoCompanySession } from '@/lib/use-seveno-company-session';
import { createStripeCheckoutClient, getBillingOrderStatusClient, getCompanyBillingClient } from '@/lib/seveno-billing-client';
import { startStripeOrderStatusPolling } from '@/lib/seveno-stripe-order-polling';
import { getCompanyJobOffer } from '@/lib/seveno-job-offers';
import { campaignContext, campaignDateLabel, campaignStatusLabel, campaignTitle } from '@/lib/seveno-billing-campaign-presentation';
import { formatBillingMovementDate, formatBillingMovementVariation, getBillingMovementLabel } from '@/lib/seveno-billing-movement-presentation';
import { withoutStripeCheckoutReturnParameters } from '@/lib/seveno-checkout-return-url';
import { formatBillingPrice } from '@/lib/seveno-billing-price-presentation';
import type { BillingProductCode, CompanyBillingView } from '@/types/seveno-billing';
import type { SerializedJobOffer } from '@/types/seveno-job-offers';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';

export default function CompanyBillingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { authUser, loading: sessionLoading, error: sessionError } = useSevenoCompanySession();
  const [billing, setBilling] = useState<CompanyBillingView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [pendingPurchase, setPendingPurchase] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [campaignOffers, setCampaignOffers] = useState<Record<string, SerializedJobOffer>>({});
  const polledCheckoutOrderRef = useRef<string | null>(null);
  const canPurchase = Boolean(billing?.canPurchaseCredits && billing.stripeCheckoutEnabled);

  const loadBilling = useCallback(async () => {
    if (!authUser) return;
    try { setBilling(await getCompanyBillingClient(authUser)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Facturation indisponible.'); }
  }, [authUser]);

  useEffect(() => { void loadBilling(); }, [loadBilling]);
  useEffect(() => {
    if (!authUser || !billing?.campaigns.length) { setCampaignOffers({}); return; }
    let cancelled = false;
    const offerIds = [...new Set(billing.campaigns.map((campaign) => campaign.offerId).filter(Boolean))];
    void Promise.allSettled(offerIds.map((offerId) => getCompanyJobOffer(authUser, offerId))).then((results) => {
      if (cancelled) return;
      const offers: Record<string, SerializedJobOffer> = {};
      results.forEach((result, index) => { if (result.status === 'fulfilled') offers[offerIds[index]] = result.value.offer; });
      setCampaignOffers(offers);
    });
    return () => { cancelled = true; };
  }, [authUser, billing]);
  useEffect(() => {
    if (!authUser) return;
    const searchParams = new URLSearchParams(window.location.search);
    const checkout = searchParams.get('checkout');
    const orderId = searchParams.get('orderId');
    if (checkout === 'cancelled') { setCheckoutMessage('Paiement annulé. Aucun droit n’a été ajouté.'); return; }
    if (checkout !== 'success' || !orderId) return;
    if (polledCheckoutOrderRef.current === orderId) return;
    polledCheckoutOrderRef.current = orderId;
    let confirmationTimer: number | null = null;
    setCheckoutMessage('Paiement reçu. La confirmation est en cours.');
    const polling = startStripeOrderStatusPolling({
      readStatus: (signal) => getBillingOrderStatusClient(authUser, orderId, signal),
      onConfirmed: async (order) => {
        if (order.status !== 'paid' || order.entitlementApplied !== true) return;
        setCheckoutMessage('Paiement confirmé. Vos droits ont été ajoutés à l’entreprise.');
        router.replace(withoutStripeCheckoutReturnParameters(pathname ?? '/entreprise/facturation', window.location.search), { scroll: false });
        confirmationTimer = window.setTimeout(() => setCheckoutMessage(null), 6000);
        await loadBilling();
      },
      onPending: () => setCheckoutMessage('Paiement reçu. La confirmation est en cours.'),
      onTerminal: (order) => {
        if (order.status === 'cancelled' || order.status === 'expired') setCheckoutMessage('Paiement annulé. Aucun droit n’a été ajouté.');
        else setCheckoutMessage('Paiement reçu. La confirmation est en cours.');
      },
      maxAttempts: 5,
      delayMs: 2000,
    });
    return () => {
      polling.stop();
      if (confirmationTimer !== null) window.clearTimeout(confirmationTimer);
    };
  }, [authUser, loadBilling, pathname, router]);

  const creditProducts = useMemo(() => billing ? Object.entries(billing.products).filter(([, product]) => product.type === 'credit_pack') : [], [billing]);

  async function purchase(productCode: BillingProductCode, campaignId?: string) {
    if (!authUser || pendingPurchase) return;
    setPurchaseError(null);
    setPendingPurchase(`${productCode}:${campaignId ?? ''}`);
    try {
      const result = await createStripeCheckoutClient(authUser, { productCode, ...(campaignId ? { campaignId } : {}), requestId: crypto.randomUUID() });
      window.location.assign(result.checkoutUrl);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '';
      if (/autorisé/i.test(message)) setPurchaseError('Vous n’êtes pas autorisé à effectuer cet achat.');
      else if (/campagne/i.test(message)) setPurchaseError('Ce produit ne peut pas être acheté pour cette campagne.');
      else setPurchaseError('Le paiement n’a pas pu être préparé. Veuillez réessayer.');
      setPendingPurchase(null);
    }
  }

  function PurchaseButton({ productCode, campaignId, label = 'Acheter' }: { productCode: BillingProductCode; campaignId?: string; label?: string }) {
    const key = `${productCode}:${campaignId ?? ''}`;
    if (!billing?.stripeCheckoutEnabled) return <p className="mt-4 text-sm text-slate-400">Paiement bientôt disponible</p>;
    if (!billing.canPurchaseCredits) return <p className="mt-4 text-sm text-slate-400">{billing.membershipRole === 'admin' ? 'L’achat de crédits est désactivé pour votre compte par le propriétaire de l’entreprise.' : 'Achat réservé aux responsables de l’entreprise et de la facturation.'}</p>;
    return <button type="button" disabled={!canPurchase || pendingPurchase !== null} onClick={() => void purchase(productCode, campaignId)} className="mt-4 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 disabled:cursor-wait disabled:opacity-60">{pendingPurchase === key ? 'Ouverture du paiement…' : label}</button>;
  }

  if (sessionLoading) return <SevenoSurface eyebrow="Entreprise" title="Facturation" description="Chargement de votre compte."><p className="text-slate-300">Chargement...</p></SevenoSurface>;
  if (sessionError || error) return <SevenoSurface eyebrow="Entreprise" title="Facturation" description="Le compte de facturation n'est pas disponible."><p className="text-orange-100">{sessionError ?? error}</p></SevenoSurface>;
  return (
    <SevenoSurface eyebrow="Entreprise" title="Facturation et crédits" description="Consultez les crédits et les mouvements du compte.">
      <h1 className="text-3xl font-semibold text-white">G&eacute;rez vos cr&eacute;dits de recrutement</h1>
      <p className="mt-3 text-slate-300">Aucun abonnement. Aucune commission sur l’embauche. Aucun renouvellement automatique.</p>
      {checkoutMessage ? <div role="status" className="mt-5 flex items-start justify-between gap-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-cyan-100"><p>{checkoutMessage}</p><button type="button" onClick={() => setCheckoutMessage(null)} className="shrink-0 rounded-full px-3 py-1 text-sm font-semibold text-cyan-50 underline decoration-cyan-200/50 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">Fermer</button></div> : null}
      {purchaseError ? <p role="alert" className="mt-5 rounded-2xl border border-orange-300/20 bg-orange-400/10 p-4 text-orange-100">{purchaseError}</p> : null}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <SevenoPanel className="p-5"><p className="text-sm text-slate-300">Crédits disponibles</p><p className="mt-2 text-4xl font-semibold text-white">{billing?.availableCredits ?? 0}</p></SevenoPanel>
        <SevenoPanel className="p-5"><p className="text-sm text-slate-300">Campagnes actives</p><p className="mt-2 text-4xl font-semibold text-white">{billing?.activeCampaignCount ?? 0}</p></SevenoPanel>
      </div>
      <h2 className="mt-8 text-2xl font-semibold text-white">Tarifs de lancement</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {creditProducts.map(([code, product]) => <SevenoPanel key={code} className="p-5"><p className="font-semibold text-white">{product.displayName}</p><p className="mt-2 text-cyan-100">{formatBillingPrice(product.unitAmountExcludingTax)} HT</p><PurchaseButton productCode={code as BillingProductCode} /></SevenoPanel>)}
      </div>
      <p className="mt-4 text-sm text-slate-400">Paiement sécurisé par Stripe</p>
      <h2 className="mt-8 text-2xl font-semibold text-white">Historique des mouvements</h2>
      <SevenoPanel className="mt-4 min-w-0 p-5">
        {billing?.ledger.length ? <>
          <div className="space-y-3 md:hidden">{billing.ledger.map((entry) => <article key={entry.entryId} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <time dateTime={entry.createdAt} className="block text-sm text-slate-300">{formatBillingMovementDate(entry.createdAt)}</time>
            <p className="mt-1 break-words font-medium text-white">{getBillingMovementLabel(entry.type)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-400">Variation</dt><dd aria-label={`Variation de ${entry.quantity} cr\u00e9dit${Math.abs(entry.quantity) > 1 ? 's' : ''}`} className={entry.quantity < 0 ? 'font-semibold text-orange-200' : 'font-semibold text-emerald-200'}>{formatBillingMovementVariation(entry.quantity)}</dd></div><div><dt className="text-slate-400">Solde</dt><dd aria-label={`Solde apr\u00e8s mouvement : ${entry.balanceAfter}`} className="font-semibold text-white">{entry.balanceAfter}</dd></div></dl>
          </article>)}</div>
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[38rem] text-left text-sm text-slate-200"><thead><tr><th className="pb-3 pr-4">Date</th><th className="pb-3 pr-4">Motif</th><th className="pb-3 pr-4">Variation</th><th className="pb-3"><span aria-hidden="true">Solde</span><span className="sr-only">{'Solde apr\u00e8s mouvement'}</span></th></tr></thead><tbody>{billing.ledger.map((entry) => <tr key={entry.entryId} className="border-t border-white/10"><td className="py-3 pr-4 whitespace-nowrap"><time dateTime={entry.createdAt}>{formatBillingMovementDate(entry.createdAt)}</time></td><td className="max-w-xs break-words py-3 pr-4">{getBillingMovementLabel(entry.type)}</td><td aria-label={`Variation de ${entry.quantity} cr\u00e9dit${Math.abs(entry.quantity) > 1 ? 's' : ''}`} className={`py-3 pr-4 font-semibold ${entry.quantity < 0 ? 'text-orange-200' : 'text-emerald-200'}`}>{formatBillingMovementVariation(entry.quantity)}</td><td className="py-3" aria-label={`Solde apr\u00e8s mouvement : ${entry.balanceAfter}`}>{entry.balanceAfter}</td></tr>)}</tbody></table></div>
        </> : <p className="text-slate-300">Aucun mouvement.</p>}
      </SevenoPanel>
      {/* Previous technical ledger table removed from rendering.
      <SevenoPanel className="mt-4 overflow-x-auto p-5">
        {billing?.ledger.length ? <table className="w-full text-left text-sm text-slate-200"><thead><tr><th>Date</th><th>Opération</th><th>Mouvement</th><th>Solde</th></tr></thead><tbody>{billing.ledger.map((entry) => <tr key={entry.entryId} className="border-t border-white/10"><td className="py-3">{new Date(entry.createdAt).toLocaleDateString('fr-FR')}</td><td>{entry.type}</td><td>{entry.quantity > 0 ? '+' : ''}{entry.quantity}</td><td>{entry.balanceAfter}</td></tr>)}</tbody></table> : <p className="text-slate-300">Aucun mouvement.</p>}
      </SevenoPanel>
      */}
      <h2 className="mt-8 text-2xl font-semibold text-white">Campagnes</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">{billing?.campaigns.map((campaign) => {
        const offer = campaignOffers[campaign.offerId];
        const context = campaignContext(offer);
        return <SevenoPanel key={campaign.campaignId} className="min-w-0 p-5">
          <div className="min-w-0">
            <h3 className="break-words text-lg font-semibold text-white">{campaignTitle(offer)}</h3>
            {context ? <p className="mt-1 break-words text-sm text-slate-400">{context}</p> : null}
            <p className="mt-3 text-sm font-medium text-cyan-100">{campaignStatusLabel(campaign.status)}</p>
            <p className="mt-1 text-sm text-slate-300">{campaignDateLabel(campaign.status, campaign.endsAt)}</p>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><dt className="text-sm text-slate-300">Candidatures qualifi&eacute;es</dt><dd className="mt-1 text-xl font-semibold text-white">{campaign.deliveredCandidateCount + campaign.queuedCandidateCount} sur {campaign.effectiveQualifiedCandidateLimit}</dd></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><dt className="text-sm text-slate-300">Dossiers en attente de d&eacute;cision</dt><dd className="mt-1 text-xl font-semibold text-white">{campaign.activeCandidateCount} sur {campaign.simultaneousCandidateLimit}</dd></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><dt className="text-sm text-slate-300">File d&rsquo;attente</dt><dd className="mt-1 text-xl font-semibold text-white">{campaign.queuedCandidateCount}</dd></div>
          </dl>
          <div className="mt-2 flex flex-col items-start gap-2 sm:flex-row"><PurchaseButton productCode="campaign_extension_30d_launch" campaignId={campaign.campaignId} label="Prolonger de 30 jours" /><PurchaseButton productCode="qualified_candidates_10_launch" campaignId={campaign.campaignId} label="Ajouter 10 candidatures" /></div>
        </SevenoPanel>;
      })}</div>
      {/* Previous technical campaign card removed from rendering.
      <div className="mt-4 grid gap-4 md:grid-cols-2">{billing?.campaigns.map((campaign) => <SevenoPanel key={campaign.campaignId} className="p-5"><p className="font-semibold text-white">Offre {campaign.offerId}</p><p className="mt-2 text-slate-300">{campaign.status} · fin le {new Date(campaign.endsAt).toLocaleDateString('fr-FR')}</p><p className="mt-2 text-slate-200">Candidatures qualifiées : {campaign.deliveredCandidateCount + campaign.queuedCandidateCount} / {campaign.effectiveQualifiedCandidateLimit}</p><p className="text-slate-200">Dossiers actifs : {campaign.activeCandidateCount} / {campaign.simultaneousCandidateLimit} · file : {campaign.queuedCandidateCount}</p><div className="mt-2 flex flex-col items-start gap-2 sm:flex-row"><PurchaseButton productCode="campaign_extension_30d_launch" campaignId={campaign.campaignId} label="Prolonger de 30 jours" /><PurchaseButton productCode="qualified_candidates_10_launch" campaignId={campaign.campaignId} label="Ajouter 10 candidatures" /></div></SevenoPanel>)}</div>
      */}
    </SevenoSurface>
  );
}
