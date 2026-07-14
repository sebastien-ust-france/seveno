import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest } from '@/lib/seveno-admin-auth';
import { writeAdminLog } from '@/lib/seveno-admin-service';
import { getPrerequisiteDetail, updatePrerequisite } from '@/lib/seveno-prerequisites-server';
import { readJsonBody } from '../../_shared';
import { toPrerequisiteAdminErrorResponse } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    await requireSevenoAdminSessionFromRequest(request);
    const { code } = await context.params;
    const payload = await getPrerequisiteDetail(code);
    if (!payload) return NextResponse.json({ error: 'not_found', message: 'Prerequis introuvable.' }, { status: 404 });
    return NextResponse.json(payload);
  } catch (error) {
    return toPrerequisiteAdminErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const session = await requireSevenoAdminSessionFromRequest(request);
    const body = await readJsonBody(request);
    const { code } = await context.params;
    const definition = await updatePrerequisite(session.user.uid, code, body);
    await writeAdminLog('prerequisite_updated', session.user, 'prerequisite_definitions', definition.id, {
      code: definition.code,
      version: definition.version,
    });
    return NextResponse.json({ definition });
  } catch (error) {
    return toPrerequisiteAdminErrorResponse(error);
  }
}
