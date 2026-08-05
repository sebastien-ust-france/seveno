import { NextRequest, NextResponse } from 'next/server';
import { SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { SevenoJobApplicationError } from '@/lib/seveno-job-applications-server';
import { CompanyMembershipError } from '@/lib/seveno-company-memberships-server';

export async function readApplicationBody(request: NextRequest) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function toApplicationApiError(error: unknown) {
  if (error instanceof SevenoApiAuthError || error instanceof SevenoJobApplicationError || error instanceof CompanyMembershipError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }
  console.error('[SevenO job applications] Unexpected server error', error);
  return NextResponse.json(
    { error: 'unexpected_error', message: 'Le parcours de candidature est temporairement indisponible.' },
    { status: 500 },
  );
}
