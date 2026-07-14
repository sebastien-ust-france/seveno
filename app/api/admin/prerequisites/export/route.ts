import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest } from '@/lib/seveno-admin-auth';
import { exportPrerequisites } from '@/lib/seveno-prerequisites-server';
import { toPrerequisiteAdminErrorResponse } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireSevenoAdminSessionFromRequest(request);
    const payload = await exportPrerequisites();
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="seveno-prerequisites-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    return toPrerequisiteAdminErrorResponse(error);
  }
}
