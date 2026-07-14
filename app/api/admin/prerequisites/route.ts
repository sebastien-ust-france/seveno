import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest } from '@/lib/seveno-admin-auth';
import { writeAdminLog } from '@/lib/seveno-admin-service';
import { PREREQUISITE_CATEGORIES, PREREQUISITE_STATUSES } from '@/lib/seveno-prerequisite-constants';
import { buildAdminApplicabilityKeys, createPrerequisite, listPrerequisites, SevenoPrerequisiteError } from '@/lib/seveno-prerequisites-server';
import type { PrerequisiteCategory, PrerequisiteStatus } from '@/types/seveno-prerequisites';
import { readJsonBody } from '../_shared';
import { toPrerequisiteAdminErrorResponse } from './_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireSevenoAdminSessionFromRequest(request);
    const statusValue = request.nextUrl.searchParams.get('status')?.trim() ?? '';
    const categoryValue = request.nextUrl.searchParams.get('category')?.trim() ?? '';
    const status = PREREQUISITE_STATUSES.some((item) => item.value === statusValue)
      ? statusValue as PrerequisiteStatus
      : undefined;
    const category = PREREQUISITE_CATEGORIES.some((item) => item.value === categoryValue)
      ? categoryValue as PrerequisiteCategory
      : undefined;
    if ((statusValue && !status) || (categoryValue && !category)) {
      throw new SevenoPrerequisiteError('invalid_filters', 400, 'Un filtre est invalide.');
    }
    const sectorId = request.nextUrl.searchParams.get('sectorId')?.trim() ?? '';
    const jobFamilyId = request.nextUrl.searchParams.get('jobFamilyId')?.trim() ?? '';
    const jobRoleId = request.nextUrl.searchParams.get('jobRoleId')?.trim() ?? '';
    const limitValue = Number(request.nextUrl.searchParams.get('limit') ?? 50);
    if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 100) {
      throw new SevenoPrerequisiteError('invalid_limit', 400, 'La limite est invalide.');
    }
    const payload = await listPrerequisites({
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(request.nextUrl.searchParams.get('q')?.trim() ? { search: request.nextUrl.searchParams.get('q')?.trim() } : {}),
      ...(sectorId || jobFamilyId || jobRoleId
        ? { applicabilityKeys: buildAdminApplicabilityKeys({ sectorId, jobFamilyId, jobRoleId }) }
        : {}),
      limit: limitValue,
      cursor: request.nextUrl.searchParams.get('cursor') ?? undefined,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return toPrerequisiteAdminErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSevenoAdminSessionFromRequest(request);
    const body = await readJsonBody(request);
    const definition = await createPrerequisite(session.user.uid, body);
    await writeAdminLog('prerequisite_created', session.user, 'prerequisite_definitions', definition.id, {
      code: definition.code,
      version: definition.version,
    });
    return NextResponse.json({ definition }, { status: 201 });
  } catch (error) {
    return toPrerequisiteAdminErrorResponse(error);
  }
}
