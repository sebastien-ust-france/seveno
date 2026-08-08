import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { CompanyMembershipError } from '@/lib/seveno-company-memberships-server';
import { acceptMemberInvitation, MEMBER_INVITATION_COOKIE } from '@/lib/seveno-member-invitations-server';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSevenoApiToken(request);
    const invitationToken = request.cookies.get(MEMBER_INVITATION_COOKIE)?.value?.trim() ?? '';
    if (!invitationToken || !auth.email) throw new CompanyMembershipError('invalid_invitation', 400, 'Invitation invalide.');
    const response = NextResponse.json(await acceptMemberInvitation({ token: invitationToken, uid: auth.uid, email: auth.email, emailVerified: auth.email_verified === true }));
    response.cookies.set({ name: MEMBER_INVITATION_COOKIE, value: '', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/seveno/company-member-invitations', maxAge: 0 });
    return response;
  } catch (error) {
    if (error instanceof CompanyMembershipError || error instanceof SevenoApiAuthError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: 'invitation_accept_failed', message: 'Acceptation impossible.' }, { status: 500 });
  }
}
