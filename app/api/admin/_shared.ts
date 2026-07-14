import { NextRequest, NextResponse } from 'next/server';
import { SevenoAdminAuthError } from '@/lib/seveno-admin-auth';
import { SevenoAdminServiceError } from '@/lib/seveno-admin-service';

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

export function toAdminApiErrorResponse(error: unknown) {
  if (error instanceof SevenoAdminAuthError || error instanceof SevenoAdminServiceError) {
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

