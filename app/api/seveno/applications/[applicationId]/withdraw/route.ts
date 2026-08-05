import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { withdrawJobApplication } from '@/lib/seveno-job-applications-server';
import { toApplicationApiError } from '../../_shared';
import { releaseCampaignCandidateSlot } from '@/lib/seveno-recruitment-campaigns-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ applicationId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { applicationId } = await context.params;
    const application = await withdrawJobApplication(token.uid, applicationId);
    await releaseCampaignCandidateSlot({ applicationId, actorUid: token.uid, reason: 'candidate_withdrawn' });
    return NextResponse.json({ application });
  } catch (error) {
    return toApplicationApiError(error);
  }
}
