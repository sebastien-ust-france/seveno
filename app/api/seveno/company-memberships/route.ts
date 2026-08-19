import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { requireActiveCompanyMembership, mutateCompanyMembership, CompanyMembershipError } from '@/lib/seveno-company-memberships-server';
import { permissionsForRole } from '@/lib/seveno-company-roles';
import { adminDb } from '@/lib/firebase-admin';
import type { CompanyMembershipRole } from '@/types/seveno-billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter'] });
    if (!adminDb) throw new Error('Firebase Admin indisponible.');
    const snapshot = await adminDb.collection('company_memberships').where('companyId', '==', membership.companyId).get();
    const userRefs = snapshot.docs.map((doc) => adminDb!.collection('users').doc(String(doc.get('userUid'))));
    const users = userRefs.length > 0 ? await adminDb.getAll(...userRefs) : [];
    const offers = await adminDb.collection('job_offers').where('companyUid', '==', membership.companyId).get();
    const counts = new Map<string, { total: number; operational: number }>();
    for (const offer of offers.docs) {
      const uid = String(offer.get('assignedToUid') ?? '');
      if (!uid) continue;
      const current = counts.get(uid) ?? { total: 0, operational: 0 };
      current.total += 1;
      if (['draft', 'published', 'paused'].includes(String(offer.get('status')))) current.operational += 1;
      counts.set(uid, current);
    }
    return NextResponse.json({ members: snapshot.docs.map((doc, index) => ({
      ...doc.data(), permissions: doc.get('permissions') ?? permissionsForRole(doc.get('role')),
      displayName: doc.get('displayName') ?? null, email: users[index]?.get('email') ?? null,
      joinedAt: doc.get('joinedAt')?.toDate?.().toISOString() ?? null,
      createdAt: doc.get('createdAt')?.toDate?.().toISOString() ?? '',
      recruitmentCount: counts.get(String(doc.get('userUid')))?.total ?? 0,
      operationalRecruitmentCount: counts.get(String(doc.get('userUid')))?.operational ?? 0,
    })) });
  } catch (error) {
    if (error instanceof CompanyMembershipError || error instanceof SevenoApiAuthError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: 'members_unavailable', message: 'Membres indisponibles.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin'] });
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.membershipId !== 'string' || !['update', 'suspend', 'reactivate', 'remove'].includes(String(body.action))) throw new CompanyMembershipError('invalid_membership_action', 400, 'Action invalide.');
    const action = body.action as 'update' | 'suspend' | 'reactivate' | 'remove';
    if (action === 'update') {
      if (typeof body.displayName !== 'string' || !['admin', 'recruiter', 'billing_manager', 'viewer'].includes(String(body.role))
        || (body.canPurchaseCredits !== undefined && typeof body.canPurchaseCredits !== 'boolean')) throw new CompanyMembershipError('invalid_membership_update', 400, 'Modification invalide.');
      await mutateCompanyMembership({ companyId: membership.companyId, membershipId: body.membershipId, actorUid: token.uid, actorRole: membership.role, mutation: { action, displayName: body.displayName, role: body.role as Exclude<CompanyMembershipRole, 'owner'>, ...(body.role === 'admin' && typeof body.canPurchaseCredits === 'boolean' ? { canPurchaseCredits: body.canPurchaseCredits } : {}) } });
    } else {
      if (Object.keys(body).some((key) => !['membershipId', 'action'].includes(key))) throw new CompanyMembershipError('invalid_membership_action', 400, 'Champs non autorisés.');
      await mutateCompanyMembership({ companyId: membership.companyId, membershipId: body.membershipId, actorUid: token.uid, actorRole: membership.role, mutation: { action } });
    }
    return NextResponse.json({ updated: true });
  } catch (error) {
    if (error instanceof CompanyMembershipError || error instanceof SevenoApiAuthError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: 'membership_update_failed', message: 'Modification impossible.' }, { status: 500 });
  }
}
