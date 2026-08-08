import { Timestamp } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { buildCompanyMembershipId, CompanyMembershipError } from '@/lib/seveno-company-memberships-server';
import type { CompanySize } from '@/types/seveno';
import { permissionsForRole } from '@/lib/seveno-company-roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sizes = new Set<CompanySize>(['solo', '1_9', '10_49', '50_249', '250_plus']);
const limits = { companyName: 200, companyType: 120, legalName: 200, website: 200, businessSector: 160, headquartersArea: 120, contactRole: 120 } as const;

function text(value: unknown, name: keyof typeof limits, required = true) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (required && !result) throw new CompanyMembershipError('invalid_company_profile', 400, `Le champ ${name} est obligatoire.`);
  if (result.length > limits[name]) throw new CompanyMembershipError('invalid_company_profile', 400, `Le champ ${name} est trop long.`);
  return result;
}

function payload(body: Record<string, unknown>) {
  const companySize = body.companySize;
  if (!sizes.has(companySize as CompanySize)) throw new CompanyMembershipError('invalid_company_profile', 400, 'Taille d’entreprise invalide.');
  const recruitmentAreas = Array.isArray(body.recruitmentAreas)
    ? [...new Set(body.recruitmentAreas.map((item) => typeof item === 'string' ? item.trim() : '').filter(Boolean))]
    : [];
  if (recruitmentAreas.length < 1 || recruitmentAreas.length > 12 || recruitmentAreas.some((area) => area.length > 120)) {
    throw new CompanyMembershipError('invalid_company_profile', 400, 'Zones de recrutement invalides.');
  }
  const rawSiret = typeof body.siret === 'string' ? body.siret.replace(/\D/g, '') : '';
  if (rawSiret && !/^\d{14}$/.test(rawSiret)) throw new CompanyMembershipError('invalid_company_profile', 400, 'SIRET invalide.');
  return {
    companyName: text(body.companyName, 'companyName'), companyType: text(body.companyType, 'companyType'),
    legalName: text(body.legalName, 'legalName', false), website: text(body.website, 'website', false),
    businessSector: text(body.businessSector, 'businessSector'), companySize: companySize as CompanySize,
    headquartersArea: text(body.headquartersArea, 'headquartersArea'), recruitmentAreas,
    contactRole: text(body.contactRole, 'contactRole'), siret: rawSiret,
  };
}

export async function POST(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    if (token.email_verified !== true) throw new CompanyMembershipError('email_not_verified', 412, 'Vérifiez votre adresse email avant de créer une entreprise.');
    if (!adminDb) throw new CompanyMembershipError('firebase_admin_missing', 500, 'Firebase Admin est indisponible.');
    const input = payload(await request.json() as Record<string, unknown>);
    const companyId = token.uid;
    const now = Timestamp.now();
    const profileRef = adminDb.collection('company_profiles').doc(companyId);
    const membershipRef = adminDb.collection('company_memberships').doc(buildCompanyMembershipId(companyId, token.uid));
    const billingRef = adminDb.collection('company_billing_accounts').doc(companyId);
    const userRef = adminDb.collection('users').doc(token.uid);
    const activeMembershipsQuery = adminDb.collection('company_memberships').where('userUid', '==', token.uid).where('status', '==', 'active');

    await adminDb.runTransaction(async (transaction) => {
      const [user, profile, membership, billing, activeMemberships] = await Promise.all([
        transaction.get(userRef), transaction.get(profileRef), transaction.get(membershipRef), transaction.get(billingRef), transaction.get(activeMembershipsQuery),
      ]);
      if (!user.exists || user.get('role') !== 'company') throw new CompanyMembershipError('forbidden_role', 403, 'Compte entreprise requis.');
      if (activeMemberships.docs.some((document) => document.get('companyId') !== companyId || document.get('role') !== 'owner')) {
        throw new CompanyMembershipError('company_membership_exists', 409, 'Ce compte appartient déjà à une entreprise existante.');
      }
      const base = {
        uid: companyId, companyId, ownerUid: token.uid, ...input,
        profileStatus: profile.get('profileStatus') ?? 'active',
        verificationStatus: profile.get('verificationStatus') ?? 'pending',
        createdAt: profile.get('createdAt') ?? now, updatedAt: now,
      };
      transaction.set(profileRef, base);
      transaction.set(membershipRef, {
        membershipId: membershipRef.id, companyId, userUid: token.uid, role: 'owner', status: 'active',
        permissions: permissionsForRole('owner'),
        invitedByUid: null, joinedAt: membership.get('joinedAt') ?? now,
        createdAt: membership.get('createdAt') ?? now, updatedAt: now,
      }, { merge: true });
      if (!billing.exists) transaction.create(billingRef, {
        companyId, availableCredits: 0, lifetimeGrantedCredits: 0, lifetimePurchasedCredits: 0,
        lifetimeConsumedCredits: 0, lifetimeRestoredCredits: 0, activeCampaignCount: 0,
        createdAt: now, updatedAt: now,
      });
      transaction.update(userRef, { onboardingCompleted: true, activeCompanyId: companyId, updatedAt: now });
    });
    return NextResponse.json({ companyId, membershipRole: 'owner', availableCredits: 0 });
  } catch (error) {
    if (error instanceof CompanyMembershipError || error instanceof SevenoApiAuthError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'company_onboarding_failed', message: 'Création de l’entreprise impossible.' }, { status: 500 });
  }
}
