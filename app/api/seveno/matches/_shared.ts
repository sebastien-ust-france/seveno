import { NextRequest, NextResponse } from 'next/server';
import { SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { SevenoMatchRequestError } from '@/lib/seveno-match-requests';
import { CompanyMembershipError } from '@/lib/seveno-company-memberships-server';

type JsonRecord = Record<string, unknown>;

export function isPlainObject(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function readJsonBody(request: NextRequest): Promise<JsonRecord | null> {
  try {
    const payload = (await request.json()) as unknown;
    return isPlainObject(payload) ? payload : null;
  } catch {
    return null;
  }
}

export function toMatchApiErrorResponse(error: unknown) {
  if (error instanceof SevenoApiAuthError || error instanceof SevenoMatchRequestError || error instanceof CompanyMembershipError) {
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
      },
      {
        status: error.status,
      },
    );
  }

  return NextResponse.json(
    {
      error: 'unexpected_error',
      message: error instanceof Error ? error.message : 'Une erreur inattendue est survenue.',
    },
    {
      status: 500,
    },
  );
}
