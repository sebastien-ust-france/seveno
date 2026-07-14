import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { savePrerequisiteAnswers, SevenoJobApplicationError } from '@/lib/seveno-job-applications-server';
import { readApplicationBody, toApplicationApiError } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ applicationId: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { applicationId } = await context.params;
    const body = await readApplicationBody(request);
    if (!body || !Array.isArray(body.answers)) {
      throw new SevenoJobApplicationError('invalid_answers', 400, 'Les reponses sont invalides.');
    }
    return NextResponse.json(await savePrerequisiteAnswers(token.uid, applicationId, body.answers));
  } catch (error) {
    return toApplicationApiError(error);
  }
}
