import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CompanyInvitationActions } from '@/components/invitation/CompanyInvitationActions';
import { getCompanyInvitationByToken } from '@/lib/seveno-company-invitations';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Invitation entreprise Seven’O',
  robots: {
    index: false,
    follow: false,
  },
};

interface InvitationEntreprisePageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function InvitationEntreprisePage({ params }: InvitationEntreprisePageProps) {
  const { token } = await params;
  if (!token) {
    notFound();
  }

  const invitation = await getCompanyInvitationByToken(token);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_28%),linear-gradient(180deg,#020617_0%,#020817_45%,#020617_100%)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-5 py-10 sm:px-8">
        <section className="w-full rounded-[32px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.96),rgba(8,15,28,0.94))] p-6 shadow-[0_24px_90px_rgba(2,6,23,0.42)] backdrop-blur sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">Invitation entreprise Seven’O</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Bienvenue sur votre invitation Seven’O</h1>

          <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-5">
            {!invitation ? (
              <div className="space-y-4">
                <p className="text-sm leading-7 text-slate-300">
                  Cette invitation est invalide ou n’existe plus. Demandez une nouvelle invitation à l’administrateur Seven’O.
                </p>
                <Link
                  href="/connexion"
                  className="inline-flex rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  Retour à la connexion
                </Link>
              </div>
            ) : invitation.status === 'expired' ? (
              <p className="text-sm leading-7 text-slate-300">
                Cette invitation a expiré. Demandez une nouvelle invitation à l’administrateur Seven’O.
              </p>
            ) : invitation.status === 'revoked' ? (
              <p className="text-sm leading-7 text-slate-300">
                Cette invitation n’est plus valide. Demandez une nouvelle invitation à l’administrateur Seven’O.
              </p>
            ) : invitation.status === 'accepted' ? (
              <p className="text-sm leading-7 text-slate-300">
                Cette invitation a déjà été utilisée.
              </p>
            ) : (
              <CompanyInvitationActions
                token={token}
                invitationEmailMasked={invitation.emailMasked}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
