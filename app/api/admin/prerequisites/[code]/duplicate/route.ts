import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest } from '@/lib/seveno-admin-auth';
import { writeAdminLog } from '@/lib/seveno-admin-service';
import { duplicatePrerequisite, SevenoPrerequisiteError } from '@/lib/seveno-prerequisites-server';
import { readJsonBody } from '../../../_shared';
import { toPrerequisiteAdminErrorResponse } from '../../_shared';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const session = await requireSevenoAdminSessionFromRequest(request);
    const body = await readJsonBody(request);
    const newCode = typeof body?.newCode === 'string' ? body.newCode : '';
    if (!newCode) throw new SevenoPrerequisiteError('missing_code', 400, 'Le nouveau code est requis.');
    const { code } = await context.params;
    const definition = await duplicatePrerequisite(session.user.uid, code, newCode);
    await writeAdminLog('prerequisite_duplicated', session.user, 'prerequisite_definitions', definition.id, {
      sourceCode: code,
      newCode: definition.code,
    });
    return NextResponse.json({ definition }, { status: 201 });
  } catch (error) {
    return toPrerequisiteAdminErrorResponse(error);
  }
}
