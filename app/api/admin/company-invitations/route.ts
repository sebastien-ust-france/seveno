import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest } from '@/lib/seveno-admin-auth';
import {
  createCompanyInvitation,
  listCompanyInvitations,
} from '@/lib/seveno-company-invitations';
import { readJsonBody, toAdminApiErrorResponse } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSevenoAdminSessionFromRequest(request);
    return jsonNoStore(await listCompanyInvitations(session));
  } catch (error) {
    return toAdminApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSevenoAdminSessionFromRequest(request);
    const body = await readJsonBody(request);
    const email = typeof body?.email === 'string' ? body.email : '';
    return jsonNoStore(await createCompanyInvitation(session, email));
  } catch (error) {
    return toAdminApiErrorResponse(error);
  }
}
