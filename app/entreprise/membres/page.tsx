'use client';

import { useEffect, useState } from 'react';
import { useSevenoCompanySession } from '@/lib/use-seveno-company-session';
import { getCompanyMembersClient } from '@/lib/seveno-billing-client';
import type { CompanyMembershipView } from '@/types/seveno-billing';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';

export default function CompanyMembersPage() {
  const { authUser, loading, error } = useSevenoCompanySession();
  const [members, setMembers] = useState<CompanyMembershipView[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => { if (authUser) getCompanyMembersClient(authUser).then((value) => setMembers(value.members)).catch((reason) => setLoadError(reason instanceof Error ? reason.message : 'Membres indisponibles.')); }, [authUser]);
  if (loading) return <SevenoSurface eyebrow="Entreprise" title="Membres" description="Chargement des accès."><p>Chargement...</p></SevenoSurface>;
  return <SevenoSurface eyebrow="Entreprise" title="Membres de l’entreprise" description="Consultez les personnes autorisées et leur rôle.">{error || loadError ? <p className="mt-4 text-orange-100">{error ?? loadError}</p> : <SevenoPanel className="overflow-x-auto p-5"><table className="w-full text-left text-sm text-slate-200"><thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>Statut</th><th>Date d’ajout</th></tr></thead><tbody>{members.map((member) => <tr key={member.membershipId} className="border-t border-white/10"><td className="py-3">{member.displayName ?? '—'}</td><td>{member.email ?? '—'}</td><td>{member.role}</td><td>{member.status}</td><td>{new Date(member.createdAt).toLocaleDateString('fr-FR')}</td></tr>)}</tbody></table></SevenoPanel>}</SevenoSurface>;
}
