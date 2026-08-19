'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { findSectorLabel } from '@/lib/job-taxonomy';
import { fetchSevenoAdminApi } from '@/lib/seveno-admin-api';
import type {
  AdminCompanyInvitationCreateResult,
  AdminCompanyInvitationListPayload,
  AdminCompanyInvitationSummary,
  AdminCompanySummary,
} from '@/types/seveno-admin';

type CompaniesPayload = {
  companies: AdminCompanySummary[];
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Non disponible';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Non disponible';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function invitationStatusLabel(status: AdminCompanyInvitationSummary['status']) {
  switch (status) {
    case 'pending':
      return 'En attente';
    case 'accepted':
      return 'Acceptée';
    case 'expired':
      return 'Expirée';
    case 'revoked':
      return 'Révoquée';
    default:
      return status;
  }
}

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<AdminCompanySummary[]>([]);
  const [invitations, setInvitations] = useState<AdminCompanyInvitationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [invitationModalOpen, setInvitationModalOpen] = useState(false);
  const [invitationEmail, setInvitationEmail] = useState('');
  const [creatingInvitation, setCreatingInvitation] = useState(false);
  const [createdInvitation, setCreatedInvitation] = useState<AdminCompanyInvitationCreateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCompanies() {
    const payload = await fetchSevenoAdminApi<CompaniesPayload>('/api/admin/companies');
    setCompanies(payload.companies);
  }

  async function loadInvitations() {
    const payload = await fetchSevenoAdminApi<AdminCompanyInvitationListPayload>('/api/admin/company-invitations');
    setInvitations(payload.invitations);
  }

  async function loadDashboard() {
    const [companiesPayload, invitationsPayload] = await Promise.all([
      fetchSevenoAdminApi<CompaniesPayload>('/api/admin/companies'),
      fetchSevenoAdminApi<AdminCompanyInvitationListPayload>('/api/admin/company-invitations'),
    ]);
    setCompanies(companiesPayload.companies);
    setInvitations(invitationsPayload.invitations);
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await loadDashboard();
        if (!active) {
          return;
        }

        setLoading(false);
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : 'Les entreprises n ont pas pu etre chargees.');
        setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  async function handleUpdate(
    uid: string,
    patch: {
      profileStatus?: 'draft' | 'active' | 'suspended';
      verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
    },
  ) {
    setSavingUid(uid);
    setError(null);

    try {
      await fetchSevenoAdminApi<AdminCompanySummary>(`/api/admin/companies/${uid}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await loadCompanies();
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La mise a jour du profil entreprise a echoue.');
    } finally {
      setSavingUid(null);
    }
  }

  async function handleCreateInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingInvitation) {
      return;
    }

    setCreatingInvitation(true);
    setError(null);

    try {
      const payload = await fetchSevenoAdminApi<AdminCompanyInvitationCreateResult>('/api/admin/company-invitations', {
        method: 'POST',
        body: JSON.stringify({ email: invitationEmail }),
      });
      setCreatedInvitation(payload);
      setInvitationEmail('');
      setInvitationModalOpen(false);
      await loadInvitations();
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La creation de l invitation a echoue.');
    } finally {
      setCreatingInvitation(false);
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    if (!window.confirm('Révoquer cette invitation entreprise ?')) {
      return;
    }

    setError(null);

    try {
      await fetchSevenoAdminApi<AdminCompanyInvitationSummary>(`/api/admin/company-invitations/${invitationId}`, {
        method: 'DELETE',
      });
      await loadInvitations();
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La révocation de l invitation a échoue.');
    }
  }

  async function handleCopyInvitationUrl() {
    if (!createdInvitation) {
      return;
    }

    try {
      await navigator.clipboard.writeText(createdInvitation.invitationUrl);
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La copie du lien a echoue.');
    }
  }

  const pendingInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === 'pending'),
    [invitations],
  );

  return (
    <SevenoSurface
      eyebrow="Administration Seven’O"
      title="Entreprises"
      description="Les profils entreprises restent accessibles uniquement sur invitation. Les actions admin portent seulement sur le statut, la vérification et les invitations."
      containerClassName="max-w-7xl"
    >
      <div className="space-y-6">
        {loading ? (
          <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
            Chargement des profils entreprises...
          </SevenoPanel>
        ) : error ? (
          <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">
            {error}
          </SevenoPanel>
        ) : (
          <div className="space-y-6">
            <SevenoPanel tone="neutral" className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                      Invitations
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Inviter une entreprise</h2>
                  </div>
                  <p className="text-sm leading-6 text-slate-300">
                    L’invitation sera valable pendant 7 jours et ne pourra être utilisée qu’avec l’adresse email prévue.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setInvitationModalOpen(true)}
                  className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Inviter une entreprise
                </button>
              </div>

              {createdInvitation ? (
                <div className="mt-5 rounded-[20px] border border-cyan-300/20 bg-cyan-500/10 p-4">
                  <p className="text-sm font-semibold text-cyan-50">Invitation créée. Copiez ce lien et transmettez-le à la personne invitée.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <code className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-xs text-cyan-100 break-all">
                      {createdInvitation.invitationUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() => void handleCopyInvitationUrl()}
                      className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/15"
                    >
                      Copier le lien
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreatedInvitation(null)}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">En attente</p>
                  <p className="mt-2 text-sm font-medium text-white">{pendingInvitations.length}</p>
                </article>
                <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Créées</p>
                  <p className="mt-2 text-sm font-medium text-white">{invitations.length}</p>
                </article>
                <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Statut</p>
                  <p className="mt-2 text-sm font-medium text-white">Invitation uniquement</p>
                </article>
                <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Sécurité</p>
                  <p className="mt-2 text-sm font-medium text-white">Aucune ouverture publique</p>
                </article>
              </div>
            </SevenoPanel>

            {invitations.length > 0 ? (
              <div className="space-y-4">
                {invitations.map((invitation) => (
                  <SevenoPanel key={invitation.invitationId} tone="neutral" className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                            Invitation entreprise
                          </p>
                          <h3 className="mt-2 text-lg font-semibold text-white">{invitation.email}</h3>
                        </div>
                        <p className="text-sm leading-6 text-slate-300">
                          Créée le {formatDateTime(invitation.createdAt)} - expire le {formatDateTime(invitation.expiresAt)}
                        </p>
                        <p className="text-sm leading-6 text-slate-300">
                          Créée par {invitation.createdByUid}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                          {invitationStatusLabel(invitation.status)}
                        </span>
                        {invitation.acceptedAt ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                            Acceptée {formatDateTime(invitation.acceptedAt)}
                          </span>
                        ) : null}
                        {invitation.revokedAt ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                            Révoquée {formatDateTime(invitation.revokedAt)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      {invitation.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => void handleRevokeInvitation(invitation.invitationId)}
                          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                        >
                          Révoquer
                        </button>
                      ) : null}
                    </div>
                  </SevenoPanel>
                ))}
              </div>
            ) : (
              <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
                Aucune invitation entreprise disponible.
              </SevenoPanel>
            )}

            <div className="space-y-4">
              {companies.length > 0 ? (
                companies.map((company) => {
                  const sectorLabel = findSectorLabel(company.businessSector) ?? company.businessSector;

                  return (
                    <SevenoPanel key={company.uid} tone="neutral" className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                              Entreprise
                            </p>
                            <h2 className="mt-2 text-xl font-semibold text-white">{company.companyName}</h2>
                          </div>
                          <p className="text-sm leading-6 text-slate-300">
                            {company.companyType} - {sectorLabel}
                          </p>
                          <p className="text-sm leading-6 text-slate-300">
                            Siège: {company.headquartersArea} - Contact: {company.contactRole}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                            {company.profileStatus}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                            {company.verificationStatus}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                            Maj {formatDateTime(company.updatedAt)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Vérification</p>
                          <p className="mt-2 text-sm font-medium text-white">{company.verificationStatus}</p>
                        </article>
                        <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Taille</p>
                          <p className="mt-2 text-sm font-medium text-white">{company.companySize}</p>
                        </article>
                        <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Zones</p>
                          <p className="mt-2 text-sm font-medium text-white">{company.recruitmentAreas.join(', ')}</p>
                        </article>
                        <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">SIRET</p>
                          <p className="mt-2 text-sm font-medium text-white">{company.siret ?? 'Non renseigné'}</p>
                        </article>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void handleUpdate(company.uid, { profileStatus: 'active' })}
                          disabled={savingUid === company.uid || company.profileStatus === 'active'}
                          className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingUid === company.uid && company.profileStatus !== 'active' ? 'Mise à jour...' : 'Activer'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleUpdate(company.uid, { profileStatus: 'suspended' })}
                          disabled={savingUid === company.uid || company.profileStatus === 'suspended'}
                          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingUid === company.uid && company.profileStatus !== 'suspended'
                            ? 'Mise à jour...'
                            : 'Suspendre'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleUpdate(company.uid, { verificationStatus: 'verified' })}
                          disabled={savingUid === company.uid || company.verificationStatus === 'verified'}
                          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingUid === company.uid && company.verificationStatus !== 'verified'
                            ? 'Mise à jour...'
                            : 'Vérifier'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleUpdate(company.uid, { verificationStatus: 'pending' })}
                          disabled={savingUid === company.uid || company.verificationStatus === 'pending'}
                          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingUid === company.uid && company.verificationStatus !== 'pending'
                            ? 'Mise à jour...'
                            : 'Mettre en attente'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleUpdate(company.uid, { verificationStatus: 'rejected' })}
                          disabled={savingUid === company.uid || company.verificationStatus === 'rejected'}
                          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingUid === company.uid && company.verificationStatus !== 'rejected'
                            ? 'Mise à jour...'
                            : 'Rejeter'}
                        </button>
                      </div>
                    </SevenoPanel>
                  );
                })
              ) : (
                <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
                  Aucun profil entreprise disponible.
                </SevenoPanel>
              )}
            </div>
          </div>
        )}
      </div>

      {invitationModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.97))] p-6 shadow-[0_24px_90px_rgba(2,6,23,0.6)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Nouvelle invitation</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Inviter une entreprise</h2>
              </div>
              <button
                type="button"
                onClick={() => setInvitationModalOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
              >
                Annuler
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={(event) => void handleCreateInvitation(event)}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Adresse email professionnelle</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={invitationEmail}
                  onChange={(event) => setInvitationEmail(event.target.value)}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                />
              </label>

              <p className="text-sm leading-6 text-slate-400">
                L’invitation sera valable pendant 7 jours et pourra uniquement être utilisée avec cette adresse email.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={creatingInvitation}
                  className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingInvitation ? 'Création...' : 'Créer l’invitation'}
                </button>
                <button
                  type="button"
                  onClick={() => setInvitationModalOpen(false)}
                  className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </SevenoSurface>
  );
}
