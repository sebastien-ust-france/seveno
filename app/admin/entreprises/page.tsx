'use client';

import { useEffect, useState } from 'react';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { findSectorLabel } from '@/lib/job-taxonomy';
import { fetchSevenoAdminApi } from '@/lib/seveno-admin-api';
import type { AdminCompanySummary } from '@/types/seveno-admin';

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

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<AdminCompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCompanies() {
    const payload = await fetchSevenoAdminApi<CompaniesPayload>('/api/admin/companies');
    setCompanies(payload.companies);
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await loadCompanies();
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

  return (
    <SevenoSurface
      eyebrow="Administration Seven’O"
      title="Entreprises"
      description="Les profils entreprises restent publics dans leur forme autorisee. Les actions admin portent seulement sur le statut et la verification."
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
                          Siege: {company.headquartersArea} - Contact: {company.contactRole}
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
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Verification</p>
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
                        <p className="mt-2 text-sm font-medium text-white">{company.siret ?? 'Non renseigne'}</p>
                      </article>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void handleUpdate(company.uid, { profileStatus: 'active' })}
                        disabled={savingUid === company.uid || company.profileStatus === 'active'}
                        className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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
        )}
      </div>
    </SevenoSurface>
  );
}
