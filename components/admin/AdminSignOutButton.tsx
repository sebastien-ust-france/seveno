'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOutUser } from '@/lib/auth';

export default function AdminSignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);

    try {
      await fetch('/api/admin/session', {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {
      // Ignore cookie cleanup failures and continue with the Firebase sign-out.
    }

    try {
      await signOutUser();
    } catch {
      // Keep going: the server session has already been cleared.
    }

    router.replace('/connexion');
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      disabled={loading}
      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? 'Deconnexion...' : 'Se deconnecter'}
    </button>
  );
}

