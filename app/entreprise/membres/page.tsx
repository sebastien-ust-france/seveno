'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSevenoCompanySession } from '@/lib/use-seveno-company-session';
import { createCompanyMemberInvitationClient, getCompanyMembersClient, mutateCompanyMembershipClient } from '@/lib/seveno-billing-client';
import { canPurchaseCompanyCredits, COMPANY_ROLE_PRESENTATION } from '@/lib/seveno-company-roles';
import type { CompanyMembershipRole, CompanyMembershipView } from '@/types/seveno-billing';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';

const MEMBER_ROLES: Array<Exclude<CompanyMembershipRole, 'owner'>> = ['admin', 'recruiter', 'billing_manager', 'viewer'];
const STATUS_LABEL = { active: 'Actif', invited: 'Invité', suspended: 'Suspendu', removed: 'Retiré' } as const;
type LifecycleAction = 'suspend' | 'reactivate' | 'remove';

export default function CompanyMembersPage() {
  const { authUser, loading, error } = useSevenoCompanySession();
  const [members, setMembers] = useState<CompanyMembershipView[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<CompanyMembershipRole, 'owner'>>('recruiter');
  const [adminCanPurchaseCredits, setAdminCanPurchaseCredits] = useState(true);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [invitationEmailSent, setInvitationEmailSent] = useState<boolean | null>(null);
  const [editing, setEditing] = useState<CompanyMembershipView | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<Exclude<CompanyMembershipRole, 'owner'>>('recruiter');
  const [editCanPurchase, setEditCanPurchase] = useState(true);
  const [confirmation, setConfirmation] = useState<{ member: CompanyMembershipView; action: LifecycleAction } | null>(null);
  const [showFormerMembers, setShowFormerMembers] = useState(false);
  const currentMembership = members.find((member) => member.userUid === authUser?.uid);
  const isOwner = currentMembership?.role === 'owner' && currentMembership.status === 'active';
  const visibleMembers = useMemo(() => members.filter((member) => showFormerMembers ? member.status === 'removed' : member.status !== 'removed'), [members, showFormerMembers]);

  const loadMembers = useCallback(async () => {
    if (!authUser) return;
    try { setMembers((await getCompanyMembersClient(authUser)).members); setLoadError(null); }
    catch (reason) { setLoadError(reason instanceof Error ? reason.message : 'Membres indisponibles.'); }
  }, [authUser]);
  useEffect(() => { void loadMembers(); }, [loadMembers]);

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!authUser) return;
    try {
      const result = await createCompanyMemberInvitationClient(authUser, { email, role, ...(role === 'admin' ? { canPurchaseCredits: adminCanPurchaseCredits } : {}) });
      setInvitationUrl(result.invitationUrl); setInvitationEmailSent(result.emailSent); setEmail('');
    } catch (reason) { setLoadError(reason instanceof Error ? reason.message : 'Invitation impossible.'); }
  }

  function openEditor(member: CompanyMembershipView) {
    if (member.role === 'owner') return;
    setEditing(member); setEditName(member.displayName ?? ''); setEditRole(member.role); setEditCanPurchase(member.permissions.canPurchaseCredits !== false);
  }

  async function saveMember(event: FormEvent) {
    event.preventDefault();
    if (!authUser || !editing) return;
    if (editing.operationalRecruitmentCount > 0 && (editRole === 'billing_manager' || editRole === 'viewer')) {
      setLoadError(`Ce membre est responsable de ${editing.operationalRecruitmentCount} recrutements actifs. Réattribuez-les avant de poursuivre.`);
      return;
    }
    try {
      await mutateCompanyMembershipClient(authUser, { membershipId: editing.membershipId, action: 'update', displayName: editName, role: editRole, ...(editRole === 'admin' ? { canPurchaseCredits: editCanPurchase } : {}) });
      setEditing(null); await loadMembers();
    } catch (reason) { setLoadError(reason instanceof Error ? reason.message : 'Modification impossible.'); }
  }

  async function confirmLifecycleAction() {
    if (!authUser || !confirmation) return;
    if (confirmation.action !== 'reactivate' && confirmation.member.operationalRecruitmentCount > 0) {
      setLoadError(`Ce membre est responsable de ${confirmation.member.operationalRecruitmentCount} recrutements actifs. Réattribuez-les avant de poursuivre.`);
      setConfirmation(null);
      return;
    }
    try {
      await mutateCompanyMembershipClient(authUser, { membershipId: confirmation.member.membershipId, action: confirmation.action });
      setConfirmation(null); await loadMembers();
    } catch (reason) { setLoadError(reason instanceof Error ? reason.message : 'Modification impossible.'); }
  }

  function canManage(member: CompanyMembershipView) {
    if (!currentMembership || member.userUid === authUser?.uid || member.role === 'owner' || member.status === 'removed') return false;
    return isOwner || (currentMembership.role === 'admin' && member.role !== 'admin');
  }

  if (loading) return <SevenoSurface eyebrow="Entreprise" title="Membres" description="Chargement des accès."><p>Chargement...</p></SevenoSurface>;
  return <SevenoSurface eyebrow="Entreprise" title="Membres de l’entreprise" description="Gérez les accès sans modifier les comptes Seven’O des utilisateurs.">
    <SevenoPanel className="mb-5 p-5"><form onSubmit={(event) => void invite(event)} className="grid gap-4"><div className="grid gap-3 md:grid-cols-[1fr_auto_auto]"><input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="membre@entreprise.fr" className="rounded-xl bg-slate-950 p-3"/><select value={role} onChange={(event) => setRole(event.target.value as Exclude<CompanyMembershipRole, 'owner'>)} className="rounded-xl bg-slate-950 p-3">{MEMBER_ROLES.filter((value) => isOwner || value !== 'admin').map((value) => <option key={value} value={value}>{COMPANY_ROLE_PRESENTATION[value].label}</option>)}</select><button className="rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950">Inviter</button></div><div className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><p className="font-semibold text-white">{COMPANY_ROLE_PRESENTATION[role].label}</p><p className="mt-1 text-sm text-slate-300">{COMPANY_ROLE_PRESENTATION[role].description}</p>{COMPANY_ROLE_PRESENTATION[role].detail ? <p className="mt-2 text-sm text-cyan-100">{COMPANY_ROLE_PRESENTATION[role].detail}</p> : null}{role === 'admin' && isOwner ? <label className="mt-4 flex gap-3 text-sm"><input type="checkbox" checked={adminCanPurchaseCredits} onChange={(event) => setAdminCanPurchaseCredits(event.target.checked)}/><span>Autoriser cet administrateur à acheter des crédits<span className="block text-slate-400">Vous pourrez modifier cette autorisation à tout moment depuis la gestion des membres.</span></span></label> : null}</div></form>{invitationUrl ? <p className="mt-4 break-all text-sm text-cyan-100">Lien à transmettre : {invitationUrl}</p> : null}</SevenoPanel>
    {invitationUrl ? <p className="mb-4 text-sm text-slate-300">{invitationEmailSent ? 'L’e-mail d’invitation a été envoyé.' : 'L’e-mail n’a pas pu être envoyé automatiquement. Transmettez le lien affiché ci-dessus par un canal sûr.'}</p> : null}<div className="mb-4 flex justify-end"><button type="button" onClick={() => setShowFormerMembers((value) => !value)} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white">{showFormerMembers ? 'Membres actuels' : 'Anciens membres'}</button></div>
    {error || loadError ? <p className="mb-4 text-orange-100">{error ?? loadError}</p> : null}
    <div className="mb-5 grid gap-3">{visibleMembers.filter((member) => ['owner', 'admin', 'recruiter'].includes(member.role)).map((member) => <div key={`recruitments-${member.membershipId}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div><p className="font-semibold text-white">{member.displayName || member.email || 'Membre'}</p><p className="mt-1 text-sm text-slate-300">{member.recruitmentCount} recrutement(s) attribué(s)</p>{member.operationalRecruitmentCount > 0 ? <p className="mt-1 text-sm text-orange-100">{member.operationalRecruitmentCount} recrutement(s) actif(s) à réattribuer avant suspension, retrait ou rôle non opérationnel.</p> : null}</div>{currentMembership && ['owner', 'admin'].includes(currentMembership.role) ? <a href={`/entreprise/offres?scope=company&assignedToUid=${encodeURIComponent(member.userUid)}`} className="text-sm text-cyan-100">Voir ses recrutements</a> : null}</div>)}</div>
    <div className="grid gap-4">{visibleMembers.map((member) => { const presentation = COMPANY_ROLE_PRESENTATION[member.role]; const purchase = canPurchaseCompanyCredits(member); return <SevenoPanel key={member.membershipId} className="p-5"><div className="grid gap-5 lg:grid-cols-[1fr_auto]"><div><p className="text-lg font-semibold text-white">{member.displayName || member.email || 'Membre'}</p>{member.displayName && member.email ? <p className="text-sm text-slate-400">{member.email}</p> : null}<p className="mt-2 font-semibold text-cyan-100">{presentation.label}</p><p className="mt-1 text-sm text-slate-300">Statut : {STATUS_LABEL[member.status]}</p><p className="mt-1 text-sm text-slate-300">Achat de crédits : {member.role === 'admin' ? purchase ? 'Autorisé' : 'Bloqué' : purchase ? 'Autorisé' : 'Non autorisé'}</p></div>{canManage(member) ? <div className="flex flex-wrap items-start gap-2"><button type="button" onClick={() => openEditor(member)} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white">Modifier</button>{member.status === 'active' ? <button type="button" onClick={() => setConfirmation({ member, action: 'suspend' })} className="rounded-full border border-orange-300/30 px-4 py-2 text-sm text-orange-100">Suspendre l’accès</button> : member.status === 'suspended' && isOwner ? <button type="button" onClick={() => setConfirmation({ member, action: 'reactivate' })} className="rounded-full border border-cyan-300/30 px-4 py-2 text-sm text-cyan-100">Réactiver l’accès</button> : null}<button type="button" onClick={() => setConfirmation({ member, action: 'remove' })} className="rounded-full border border-rose-300/30 px-4 py-2 text-sm text-rose-100">Retirer de l’entreprise</button></div> : null}</div></SevenoPanel>; })}</div>
    {editing ? <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-5"><form onSubmit={(event) => void saveMember(event)} className="w-full max-w-lg space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-6"><h2 className="text-xl font-semibold text-white">Modifier le membre</h2><label className="block text-sm text-slate-200">Nom affiché<input required minLength={2} maxLength={80} value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-2 w-full rounded-xl bg-slate-950 p-3"/></label><label className="block text-sm text-slate-200">Rôle<select value={editRole} onChange={(event) => setEditRole(event.target.value as Exclude<CompanyMembershipRole, 'owner'>)} className="mt-2 w-full rounded-xl bg-slate-950 p-3">{MEMBER_ROLES.filter((value) => isOwner || value !== 'admin').map((value) => <option key={value} value={value}>{COMPANY_ROLE_PRESENTATION[value].label}</option>)}</select></label>{editRole === 'admin' && isOwner ? <label className="flex gap-3 text-sm text-slate-200"><input type="checkbox" checked={editCanPurchase} onChange={(event) => setEditCanPurchase(event.target.checked)}/>Autoriser l’achat de crédits</label> : null}<div className="flex justify-end gap-3"><button type="button" onClick={() => setEditing(null)} className="rounded-full border border-white/15 px-4 py-2">Annuler</button><button className="rounded-full bg-cyan-500 px-4 py-2 font-semibold text-slate-950">Enregistrer les modifications</button></div></form></div> : null}
    {confirmation ? <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-5"><div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6"><p className="text-sm leading-6 text-slate-200">{confirmation.action === 'suspend' ? 'Ce membre perdra immédiatement l’accès à l’entreprise. Son compte Seven’O ne sera pas supprimé et vous pourrez réactiver son accès ultérieurement.' : confirmation.action === 'reactivate' ? 'Ce membre retrouvera les droits correspondant à son rôle actuel.' : 'Ce membre sera retiré de l’entreprise et perdra immédiatement tous ses accès. Son compte Seven’O ne sera pas supprimé. Une nouvelle invitation sera nécessaire pour qu’il rejoigne de nouveau l’entreprise.'}</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setConfirmation(null)} className="rounded-full border border-white/15 px-4 py-2">Annuler</button><button type="button" onClick={() => void confirmLifecycleAction()} className="rounded-full bg-rose-500 px-4 py-2 font-semibold text-white">{confirmation.action === 'suspend' ? 'Suspendre l’accès' : confirmation.action === 'reactivate' ? 'Réactiver' : 'Retirer de l’entreprise'}</button></div></div></div> : null}
  </SevenoSurface>;
}
