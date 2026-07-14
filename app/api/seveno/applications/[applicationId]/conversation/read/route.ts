import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import {
  markJobApplicationConversationRead,
  SevenoJobApplicationError,
} from '@/lib/seveno-job-applications-server';
import { toApplicationApiError } from '../../../_shared';
import { getSevenoUserByUid } from '@/lib/seveno-match-requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ applicationId: string }> };

async function resolveParticipant(tokenUid: string) {
  const actor = await getSevenoUserByUid(tokenUid);
  if (!actor || !actor.role) {
    throw new SevenoJobApplicationError('forbidden_role', 403, 'Acces refuse.');
  }
  if (actor.role !== 'candidate' && actor.role !== 'company' && actor.role !== 'admin') {
    throw new SevenoJobApplicationError('forbidden_role', 403, 'Acces refuse.');
  }
  return { uid: tokenUid, role: actor.role };
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { applicationId } = await context.params;
    const participant = await resolveParticipant(token.uid);
    return NextResponse.json(await markJobApplicationConversationRead(applicationId, participant));
  } catch (error) {
    return toApplicationApiError(error);
  }
}
