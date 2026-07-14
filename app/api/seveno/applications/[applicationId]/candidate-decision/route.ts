import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import {
  respondToJobApplicationInvitation,
  SevenoJobApplicationError,
} from '@/lib/seveno-job-applications-server';
import { readApplicationBody, toApplicationApiError } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ applicationId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { applicationId } = await context.params;
    const body = await readApplicationBody(request);
    if (!body) {
      throw new SevenoJobApplicationError('invalid_payload', 400, 'Le contenu envoye est invalide.');
    }

    const decision = body.decision === 'accepted' || body.decision === 'declined' ? body.decision : '';
    if (!decision) {
      throw new SevenoJobApplicationError('invalid_decision', 400, 'La decision doit etre acceptee ou refusee.');
    }

    return NextResponse.json({
      application: await respondToJobApplicationInvitation(token.uid, applicationId, decision),
    });
  } catch (error) {
    return toApplicationApiError(error);
  }
}
