import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { buildCompanyMembershipId, CompanyMembershipError, requireActiveCompanyMembership } from '@/lib/seveno-company-memberships-server';
import { COMPANY_ROLE_PRESENTATION } from '@/lib/seveno-company-roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter'] });
    if (!adminDb) throw new Error('Firebase Admin indisponible.');
    const membershipId = buildCompanyMembershipId(membership.companyId, token.uid);
    const [member, offers] = await Promise.all([
      adminDb.collection('company_memberships').doc(membershipId).get(),
      adminDb.collection('job_offers').where('companyUid', '==', membership.companyId).where('assignedToUid', '==', token.uid).get(),
    ]);
    const offerIds = new Set(offers.docs.map((offer) => offer.id));
    const applications = offerIds.size > 0
      ? await adminDb.collection('job_applications').where('companyUid', '==', membership.companyId).get()
      : null;
    const assignedApplications = applications?.docs.filter((application) => offerIds.has(String(application.get('offerId')))) ?? [];
    const activeStatuses = new Set(['published', 'paused']);
    const actionableStatuses = new Set(['submitted', 'questionnaire_completed']);
    return NextResponse.json({
      displayName: member.get('displayName') ?? member.get('email') ?? token.email ?? null,
      role: membership.role,
      roleLabel: COMPANY_ROLE_PRESENTATION[membership.role].label,
      activeRecruitments: offers.docs.filter((offer) => activeStatuses.has(String(offer.get('status')))).length,
      applicationsToReview: assignedApplications.filter((application) => actionableStatuses.has(String(application.get('status')))).length,
      completedQuestionnaires: assignedApplications.filter((application) => application.get('status') === 'questionnaire_completed').length,
      pendingIntroductions: assignedApplications.filter((application) => application.get('status') === 'contact_requested').length,
      assignedRecruitments: offers.size,
      canViewAllRecruitments: membership.role === 'owner' || membership.role === 'admin',
    });
  } catch (error) {
    if (error instanceof SevenoApiAuthError || error instanceof CompanyMembershipError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: 'dashboard_unavailable', message: 'Le tableau de bord est indisponible.' }, { status: 500 });
  }
}
