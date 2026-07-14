import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest } from '@/lib/seveno-admin-auth';
import { writeAdminLog } from '@/lib/seveno-admin-service';
import { PREREQUISITE_STATUSES } from '@/lib/seveno-prerequisite-constants';
import { updatePrerequisiteStatus, SevenoPrerequisiteError } from '@/lib/seveno-prerequisites-server';
import type { PrerequisiteStatus } from '@/types/seveno-prerequisites';
import { readJsonBody } from '../../../_shared';
import { toPrerequisiteAdminErrorResponse } from '../../_shared';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const session = await requireSevenoAdminSessionFromRequest(request);
    const body = await readJsonBody(request);
    const status = body?.status;
    if (typeof status !== 'string' || !PREREQUISITE_STATUSES.some((item) => item.value === status)) {
      throw new SevenoPrerequisiteError('invalid_status', 400, 'Le statut est invalide.');
    }
    const { code } = await context.params;
    const definition = await updatePrerequisiteStatus(session.user.uid, code, status as PrerequisiteStatus);
    await writeAdminLog('prerequisite_status_changed', session.user, 'prerequisite_definitions', definition.id, {
      code: definition.code,
      status,
    });
    return NextResponse.json({ definition });
  } catch (error) {
    return toPrerequisiteAdminErrorResponse(error);
  }
}
