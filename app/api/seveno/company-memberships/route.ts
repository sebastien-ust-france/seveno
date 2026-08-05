import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { requireActiveCompanyMembership, upsertCompanyMembership, CompanyMembershipError } from '@/lib/seveno-company-memberships-server';
import { adminDb } from '@/lib/firebase-admin';
import type { CompanyMembershipRole, CompanyMembershipStatus } from '@/types/seveno-billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin'] });
    const firestore = adminDb;
    if (!firestore) throw new Error('Firebase Admin indisponible.');
    const snapshot = await firestore.collection('company_memberships').where('companyId', '==', membership.companyId).get();
    const userRefs = snapshot.docs.map((doc) => firestore.collection('users').doc(String(doc.get('userUid'))));
    const users = userRefs.length > 0 ? await firestore.getAll(...userRefs) : [];
    return NextResponse.json({ members: snapshot.docs.map((doc, index) => ({ ...doc.data(), displayName: users[index]?.get('displayName') ?? null, email: users[index]?.get('email') ?? null, joinedAt: doc.get('joinedAt')?.toDate?.().toISOString() ?? null, createdAt: doc.get('createdAt')?.toDate?.().toISOString() ?? '' })) });
  } catch (error) {
    if (error instanceof CompanyMembershipError || error instanceof SevenoApiAuthError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: 'members_unavailable', message: 'Membres indisponibles.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin'] });
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.userUid !== 'string' || typeof body.role !== 'string' || typeof body.status !== 'string' || typeof body.reason !== 'string') {
      throw new CompanyMembershipError('invalid_membership', 400, 'Adhésion invalide.');
    }
    const membershipId = await upsertCompanyMembership({ companyId: membership.companyId, userUid: body.userUid, role: body.role as CompanyMembershipRole, status: body.status as CompanyMembershipStatus, actorUid: token.uid, reason: body.reason });
    return NextResponse.json({ membershipId });
  } catch (error) {
    if (error instanceof CompanyMembershipError || error instanceof SevenoApiAuthError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: 'membership_update_failed', message: 'Modification impossible.' }, { status: 500 });
  }
}
