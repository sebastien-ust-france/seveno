'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentAuthUser } from '@/lib/auth';
import { ensureSevenoUser, resolveSevenoRedirect } from '@/lib/seveno-users';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';

export default function AdminBootstrapGate() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function bootstrapAdminSession() {
      try {
        const authUser = await getCurrentAuthUser();
        if (!active) {
          return;
        }

        if (!authUser) {
          setChecking(false);
          return;
        }

        const sevenoUser = await ensureSevenoUser(authUser);
        if (!active) {
          return;
        }

        if (sevenoUser.role !== 'admin') {
          router.replace(resolveSevenoRedirect(sevenoUser));
          return;
        }

        const token = await authUser.getIdToken();
        const response = await fetch('/api/admin/session', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message ?? 'La session admin n a pas pu etre initialisee.');
        }

        router.refresh();
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : 'L’accès administrateur n’a pas pu être vérifié.');
        setChecking(false);
      }
    }

    void bootstrapAdminSession();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <SevenoSurface
      eyebrow="Accès admin"
      title="Vérification de votre session Seven’O"
      description="L’espace admin reste privé. La page vérifie le jeton Firebase côté serveur puis autorise uniquement les comptes dont le rôle est administrateur."
      containerClassName="max-w-4xl"
    >
      <div className="space-y-5">
        <SevenoPanel tone="neutral" className="p-5 text-sm leading-7 text-slate-300">
          {checking ? (
            <>
              <p className="font-medium text-white">Vérification de votre session administrateur…</p>
              <p className="mt-3">
                Le serveur controle le jeton Firebase puis lit le document <code className="text-cyan-100">users/uid</code>{' '}
                pour confirmer le role admin avant d afficher les donnees sensibles.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-white">Connexion requise</p>
              <p className="mt-3">
                Connectez-vous avec le compte administrateur autorisé puis revenez ici. Si votre compte n’est pas administrateur, vous
                serez redirige automatiquement vers votre espace.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/connexion"
                  className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Aller a la connexion
                </Link>
                <Link
                  href="/"
                  className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  Retour a l accueil
                </Link>
              </div>
            </>
          )}
        </SevenoPanel>

        {error ? (
          <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">
            {error}
          </SevenoPanel>
        ) : null}
      </div>
    </SevenoSurface>
  );
}
