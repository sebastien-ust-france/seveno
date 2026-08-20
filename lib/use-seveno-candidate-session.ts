'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { User } from 'firebase/auth';
import { getCurrentAuthUser } from '@/lib/auth';
import { getCandidateProfile } from '@/lib/seveno-candidates';
import { ensureSevenoUser, hasSevenoTermsAcceptance, resolveSevenoRedirect } from '@/lib/seveno-users';
import { shouldAllowCandidateOnboardingWithoutProfile } from '@/lib/seveno-candidate-session-gate';
import { normalizePublicOfferReturnTo } from '@/lib/seveno-public-offer-return';
import type { CandidateProfile } from '@/types/seveno';

export function useSevenoCandidateSession() {
  const router = useRouter();
  const pathname = usePathname();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const firebaseUser = await getCurrentAuthUser();
        if (!active) return;
        if (!firebaseUser) {
          const publicOfferReturnTo = normalizePublicOfferReturnTo(pathname);
          router.replace(publicOfferReturnTo
            ? `/connexion?returnTo=${encodeURIComponent(publicOfferReturnTo)}`
            : '/connexion');
          return;
        }
        const sevenoUser = await ensureSevenoUser(firebaseUser);
        if (!active) return;
        if (!sevenoUser.role) {
          router.replace('/onboarding');
          return;
        }
        if (sevenoUser.role !== 'candidate') {
          router.replace(resolveSevenoRedirect(sevenoUser));
          return;
        }

        if (!hasSevenoTermsAcceptance(sevenoUser, 'candidate_account') && pathname !== '/candidat/onboarding') {
          router.replace('/cgu');
          return;
        }

        const candidateProfile = await getCandidateProfile(sevenoUser.uid);
        if (!active) return;
        if (!candidateProfile) {
          if (shouldAllowCandidateOnboardingWithoutProfile(pathname, false)) {
            setAuthUser(firebaseUser);
            setProfile(null);
            return;
          }
          router.replace('/candidat/onboarding');
          return;
        }
        setAuthUser(firebaseUser);
        setProfile(candidateProfile);
      } catch (thrownError) {
        if (active) setError(thrownError instanceof Error ? thrownError.message : 'La session candidat est indisponible.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [pathname, router]);

  return { authUser, profile, loading, error };
}
