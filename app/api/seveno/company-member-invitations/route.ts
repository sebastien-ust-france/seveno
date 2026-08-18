import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { requireActiveCompanyMembership, CompanyMembershipError } from '@/lib/seveno-company-memberships-server';
import { createMemberInvitation } from '@/lib/seveno-member-invitations-server';
import { consumeSevenoRateLimits, normalizeRateLimitEmail, SevenoRateLimitConfigurationError } from '@/lib/seveno-rate-limit';
import type { CompanyMembershipRole } from '@/types/seveno-billing';

export async function POST(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin'] });
    const body = await request.json() as { email?: unknown; role?: unknown; canPurchaseCredits?: unknown };
    if (typeof body.email !== 'string' || typeof body.role !== 'string') throw new CompanyMembershipError('invalid_invitation', 400, 'Invitation invalide.');
    if (body.canPurchaseCredits !== undefined && typeof body.canPurchaseCredits !== 'boolean') throw new CompanyMembershipError('invalid_permission', 400, 'Autorisation invalide.');
    if (body.canPurchaseCredits !== undefined && body.role !== 'admin') throw new CompanyMembershipError('invalid_permission_role', 400, 'Cette autorisation concerne uniquement les administrateurs.');
    const rateLimit = await consumeSevenoRateLimits([
      { scope: 'company-member-invitation-company-hour', key: membership.companyId, limit: 10, windowSeconds: 60 * 60 },
      { scope: 'company-member-invitation-company-day', key: membership.companyId, limit: 50, windowSeconds: 24 * 60 * 60 },
      { scope: 'company-member-invitation-recipient-day', key: normalizeRateLimitEmail(body.email), limit: 2, windowSeconds: 24 * 60 * 60 },
      { scope: 'company-member-invitation-recipient-week', key: normalizeRateLimitEmail(body.email), limit: 3, windowSeconds: 7 * 24 * 60 * 60 },
    ]);
    if (!rateLimit.allowed) return NextResponse.json({ error: 'rate_limit_exceeded', retryAfterSeconds: rateLimit.retryAfterSeconds }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } });
    const result = await createMemberInvitation({ companyId: membership.companyId, actorUid: token.uid, actorRole: membership.role, email: body.email, role: body.role as CompanyMembershipRole, ...(body.role === 'admin' ? { adminCanPurchaseCredits: body.canPurchaseCredits !== false } : {}) });
    return NextResponse.json({ invitationId: result.invitationId, email: result.email, role: result.role, expiresAt: result.expiresAt, invitationUrl: result.invitationUrl, emailSent: result.emailSent, emailFailureReason: result.emailFailureReason }, { status: 201 });
  } catch (error) {
    if (error instanceof SevenoRateLimitConfigurationError) return NextResponse.json({ error: 'rate_limit_unavailable' }, { status: 503 });
    if (error instanceof CompanyMembershipError || error instanceof SevenoApiAuthError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: 'invitation_failed', message: 'Invitation impossible.' }, { status: 500 });
  }
}
