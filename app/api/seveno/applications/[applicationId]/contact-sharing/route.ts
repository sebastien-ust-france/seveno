import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { getSevenoUserByUid } from '@/lib/seveno-match-requests';
import {
  getJobApplicationContactSharing,
  shareJobApplicationContact,
  SevenoJobApplicationError,
} from '@/lib/seveno-job-applications-server';
import { readApplicationBody, toApplicationApiError } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ applicationId: string }> };

async function resolveParticipant(uid: string) {
  const user = await getSevenoUserByUid(uid);
  if (!user || (user.role !== 'candidate' && user.role !== 'company')) {
    throw new SevenoJobApplicationError('forbidden_role', 403, 'Accès refusé.');
  }
  return { uid, role: user.role };
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { applicationId } = await context.params;
    return NextResponse.json(await getJobApplicationContactSharing(applicationId, await resolveParticipant(token.uid)));
  } catch (error) {
    return toApplicationApiError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const body = await readApplicationBody(request);
    if (!body || body.action !== 'share') {
      throw new SevenoJobApplicationError('invalid_payload', 400, 'L’action de partage est invalide.');
    }
    const { applicationId } = await context.params;
    return NextResponse.json(await shareJobApplicationContact(applicationId, await resolveParticipant(token.uid)));
  } catch (error) {
    return toApplicationApiError(error);
  }
}