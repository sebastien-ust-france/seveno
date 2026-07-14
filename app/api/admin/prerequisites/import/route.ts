import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest } from '@/lib/seveno-admin-auth';
import { writeAdminLog } from '@/lib/seveno-admin-service';
import { importPrerequisites } from '@/lib/seveno-prerequisites-server';
import { readJsonBody } from '../../_shared';
import { toPrerequisiteAdminErrorResponse } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await requireSevenoAdminSessionFromRequest(request);
    const body = await readJsonBody(request);
    const report = await importPrerequisites(session.user.uid, body);
    await writeAdminLog('prerequisite_import_processed', session.user, 'prerequisite_definitions', undefined, {
      dryRun: report.dryRun,
      total: report.total,
      created: report.created.length,
      updated: report.updated.length,
      unchanged: report.unchanged.length,
      errors: report.errors.length,
    });
    return NextResponse.json({ report });
  } catch (error) {
    return toPrerequisiteAdminErrorResponse(error);
  }
}
