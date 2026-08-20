'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import {
  buildPublicOfferCandidateReturnTo,
  consumePublicOfferReturnTo,
  persistPublicOfferReturnTo,
} from '@/lib/seveno-public-offer-return';
import { useSevenoCandidateSession } from '@/lib/use-seveno-candidate-session';

export function CandidatePublicOfferRedirect({ slug }: { slug: string }) {
  const router = useRouter();
  const { authUser, loading: sessionLoading, error: sessionError } = useSevenoCandidateSession();
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    try {
      persistPublicOfferReturnTo(buildPublicOfferCandidateReturnTo(slug));
    } catch {
      setUnavailable(true);
    }
  }, [slug]);

  useEffect(() => {
    if (!authUser) return;
    let active = true;
    async function resolveOffer() {
      try {
        const payload = await fetchSevenoMatchApi<{ offerId: string }>(
          authUser!,
          `/api/seveno/candidate-offers/public/${encodeURIComponent(slug)}`,
        );
        if (active) {
          consumePublicOfferReturnTo();
          router.replace(`/candidat/offres/${encodeURIComponent(payload.offerId)}`);
        }
      } catch {
        if (active) {
          consumePublicOfferReturnTo();
          setUnavailable(true);
        }
      }
    }
    void resolveOffer();
    return () => { active = false; };
  }, [authUser, router, slug]);

  return (
    <SevenoSurface
      eyebrow="Espace candidat"
      title={unavailable ? 'Offre indisponible' : 'Ouverture de l’offre'}
      description="Seven’O vérifie que ce recrutement est toujours ouvert."
      containerClassName="max-w-4xl"
    >
      {sessionError ? <SevenoPanel tone="orange"><p className="text-sm text-orange-100">{sessionError}</p></SevenoPanel> : null}
      {unavailable ? (
        <SevenoPanel tone="orange">
          <p className="text-sm leading-7 text-orange-100">Cette offre n’est plus publiée ou sa campagne de recrutement est terminée.</p>
          <Link href="/candidat/offres" className="mt-4 inline-flex rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white">
            Voir les offres disponibles
          </Link>
        </SevenoPanel>
      ) : sessionLoading || authUser ? <p className="text-sm text-slate-400">Vérification en cours…</p> : null}
    </SevenoSurface>
  );
}
