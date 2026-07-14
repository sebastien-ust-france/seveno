'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from 'firebase/auth';
import { getCurrentAuthUser } from '@/lib/auth';
import { getCandidateProfile } from '@/lib/seveno-candidates';
import { ensureSevenoUser, resolveSevenoRedirect } from '@/lib/seveno-users';
import type { CandidateProfile } from '@/types/seveno';

export function useSevenoCandidateSession() {
  const router = useRouter();
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
          router.replace('/connexion');
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
        const candidateProfile = await getCandidateProfile(sevenoUser.uid);
        if (!active) return;
        if (!candidateProfile) {
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
  }, [router]);

  return { authUser, profile, loading, error };
}
