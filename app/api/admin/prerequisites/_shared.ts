import { NextResponse } from 'next/server';
import { SevenoAdminAuthError } from '@/lib/seveno-admin-auth';
import { SevenoPrerequisiteError } from '@/lib/seveno-prerequisites-server';

export function toPrerequisiteAdminErrorResponse(error: unknown) {
  if (error instanceof SevenoAdminAuthError || error instanceof SevenoPrerequisiteError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { error: 'unexpected_error', message: error instanceof Error ? error.message : 'Une erreur inattendue est survenue.' },
    { status: 500 },
  );
}
