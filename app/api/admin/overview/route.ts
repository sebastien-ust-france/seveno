import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest } from '@/lib/seveno-admin-auth';
import { loadAdminOverview } from '@/lib/seveno-admin-service';
import { toAdminApiErrorResponse } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireSevenoAdminSessionFromRequest(request);
    const payload = await loadAdminOverview();
    return NextResponse.json(payload);
  } catch (error) {
    return toAdminApiErrorResponse(error);
  }
}

