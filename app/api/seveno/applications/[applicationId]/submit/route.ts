import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { submitJobApplication } from '@/lib/seveno-job-applications-server';
import { toApplicationApiError } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ applicationId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { applicationId } = await context.params;
    return NextResponse.json({ application: await submitJobApplication(token.uid, applicationId) });
  } catch (error) {
    return toApplicationApiError(error);
  }
}
