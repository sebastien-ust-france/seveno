import { NextRequest, NextResponse } from 'next/server';
import { getMemberInvitation, MEMBER_INVITATION_COOKIE } from '@/lib/seveno-member-invitations-server';
import { CompanyMembershipError } from '@/lib/seveno-company-memberships-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(MEMBER_INVITATION_COOKIE)?.value?.trim() ?? '';
  if (!token) return NextResponse.json({ invitation: null }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    return NextResponse.json({ invitation: await getMemberInvitation(token) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof CompanyMembershipError) return NextResponse.json({ invitation: null, error: error.code, message: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ invitation: null }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
