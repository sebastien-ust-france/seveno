'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function MemberInvitationTokenPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void fetch('/api/seveno/company-member-invitations/claim', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        if (!response.ok) throw new Error(payload?.message || 'Cette invitation n’est pas valide.');
        if (active) router.replace('/invitation-membre');
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Cette invitation n’est pas valide.'); });
    return () => { active = false; };
  }, [router, token]);

  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white"><div className="max-w-lg rounded-2xl border border-white/10 bg-white/5 p-6 text-center"><p>{error || 'Validation sécurisée de votre invitation…'}</p>{error ? <a className="mt-5 inline-block text-cyan-300" href="/connexion">Retour à la connexion</a> : null}</div></main>;
}
