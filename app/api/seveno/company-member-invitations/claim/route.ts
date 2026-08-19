import { NextRequest, NextResponse } from 'next/server';
import { claimMemberInvitation, MEMBER_INVITATION_COOKIE, MEMBER_INVITATION_SESSION_SECONDS } from '@/lib/seveno-member-invitations-server';
import { CompanyMembershipError } from '@/lib/seveno-company-memberships-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as { token?: unknown } | null;
    if (typeof body?.token !== 'string') throw new CompanyMembershipError('invitation_invalid', 400, 'Cette invitation n’est pas valide.');
    const invitation = await claimMemberInvitation(body.token);
    const response = NextResponse.json({ invitation }, { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
    response.cookies.set({ name: MEMBER_INVITATION_COOKIE, value: body.token.trim(), httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/seveno/company-member-invitations', maxAge: MEMBER_INVITATION_SESSION_SECONDS });
    return response;
  } catch (error) {
    if (error instanceof CompanyMembershipError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ error: 'invitation_invalid', message: 'Cette invitation n’est pas valide.' }, { status: 500 });
  }
}
