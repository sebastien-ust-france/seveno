import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest } from '@/lib/seveno-admin-auth';
import { getAdminPrerequisiteSuggestionDetail } from '@/lib/seveno-prerequisite-suggestions-admin';
import { toAdminApiErrorResponse } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ suggestionId: string }> }) {
  try {
    await requireSevenoAdminSessionFromRequest(request);
    const { suggestionId } = await params;
    const payload = await getAdminPrerequisiteSuggestionDetail(suggestionId);
    return NextResponse.json(payload);
  } catch (error) {
    return toAdminApiErrorResponse(error);
  }
}
