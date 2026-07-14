import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { getCandidateApplication } from '@/lib/seveno-job-applications-server';
import { toApplicationApiError } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ applicationId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { applicationId } = await context.params;
    return NextResponse.json(await getCandidateApplication(token.uid, applicationId));
  } catch (error) {
    return toApplicationApiError(error);
  }
}
