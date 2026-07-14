import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest } from '@/lib/seveno-admin-auth';
import { SevenoAdminServiceError } from '@/lib/seveno-admin-service';
import { loadAdminPrerequisiteSuggestions } from '@/lib/seveno-prerequisite-suggestions-admin';
import { toAdminApiErrorResponse } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseLimit(value: string | null) {
  if (value === null || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    throw new SevenoAdminServiceError('invalid_limit', 400, 'La limite de pagination est invalide.');
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    await requireSevenoAdminSessionFromRequest(request);

    const payload = await loadAdminPrerequisiteSuggestions({
      ...(request.nextUrl.searchParams.get('status')?.trim() ? { status: request.nextUrl.searchParams.get('status')?.trim() } : {}),
      ...(request.nextUrl.searchParams.get('q')?.trim() ? { query: request.nextUrl.searchParams.get('q')?.trim() } : {}),
      ...(request.nextUrl.searchParams.get('sort')?.trim() ? { sort: request.nextUrl.searchParams.get('sort')?.trim() } : {}),
      limit: parseLimit(request.nextUrl.searchParams.get('limit')),
      ...(request.nextUrl.searchParams.get('cursor')?.trim() ? { cursor: request.nextUrl.searchParams.get('cursor')?.trim() } : {}),
    });

    return NextResponse.json(payload);
  } catch (error) {
    return toAdminApiErrorResponse(error);
  }
}
