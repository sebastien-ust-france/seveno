import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { listActiveCompanyMemberships, requireActiveCompanyMembership, CompanyMembershipError } from '@/lib/seveno-company-memberships-server';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const memberships = await listActiveCompanyMemberships(token.uid);
    const requested = request.headers.get('x-seveno-company-id');
    const active = await requireActiveCompanyMembership({ userUid: token.uid, companyId: requested });
    const firestore = adminDb;
    const profileRefs = firestore ? memberships.map((item) => firestore.collection('company_profiles').doc(String(item.companyId))) : [];
    const profiles = firestore && profileRefs.length > 0 ? await firestore.getAll(...profileRefs) : [];
    const activeProfileSnapshot = profiles[memberships.findIndex((item) => item.companyId === active.companyId)];
    const activeProfileData = activeProfileSnapshot?.data() ?? active.profile;
    const dateValue = (value: unknown) => value && typeof (value as { toDate?: unknown }).toDate === 'function'
      ? (value as { toDate: () => Date }).toDate().toISOString()
      : null;
    return NextResponse.json({
      activeCompanyId: active.companyId,
      activeProfile: {
        ...activeProfileData,
        uid: active.companyId,
        createdAt: dateValue(activeProfileData.createdAt),
        updatedAt: dateValue(activeProfileData.updatedAt),
      },
      companies: memberships.map((item, index) => ({ companyId: String(item.companyId), companyName: String(profiles[index]?.get('companyName') ?? ''), role: item.role })),
    });
  } catch (error) {
    const known = error instanceof CompanyMembershipError || error instanceof SevenoApiAuthError;
    return NextResponse.json({ error: known ? error.code : 'company_context_error', message: error instanceof Error ? error.message : 'Contexte indisponible.' }, { status: known ? error.status : 500 });
  }
}
