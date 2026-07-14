'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from 'firebase/auth';
import { getCurrentAuthUser } from '@/lib/auth';
import { getCompanyProfile } from '@/lib/seveno-companies';
import { ensureSevenoUser } from '@/lib/seveno-users';
import type { CompanyProfile } from '@/types/seveno';

export function useSevenoCompanySession() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
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
        if (sevenoUser.role !== 'company') {
          setError('Ce compte n a pas le role entreprise. Acces aux offres refuse.');
          return;
        }
        const companyProfile = await getCompanyProfile(sevenoUser.uid);
        if (!active) return;
        if (!companyProfile) {
          router.replace('/entreprise/onboarding');
          return;
        }
        setAuthUser(firebaseUser);
        setProfile(companyProfile);
        if (!sevenoUser.emailVerified) {
          setError('Votre adresse email doit etre verifiee pour gerer les offres.');
        } else if (companyProfile.profileStatus === 'suspended') {
          setError('Votre profil entreprise est suspendu. La gestion des offres est indisponible.');
        }
      } catch (thrownError) {
        if (active) setError(thrownError instanceof Error ? thrownError.message : 'La session entreprise est indisponible.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  return { authUser, profile, loading, error };
}
