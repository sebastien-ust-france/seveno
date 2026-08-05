import { NextRequest, NextResponse } from 'next/server';
import { SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { SevenoJobOfferError } from '@/lib/seveno-job-offers-server';
import { CompanyMembershipError } from '@/lib/seveno-company-memberships-server';
import { SevenoBillingError } from '@/lib/seveno-billing-server';

export async function readOfferJsonBody(request: NextRequest) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

export function toJobOfferApiError(error: unknown) {
  if (error instanceof SevenoApiAuthError || error instanceof SevenoJobOfferError || error instanceof CompanyMembershipError || error instanceof SevenoBillingError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }
  console.error('[SevenO job offers] Unexpected server error', error);
  return NextResponse.json(
    { error: 'unexpected_error', message: 'La gestion des offres est temporairement indisponible.' },
    { status: 500 },
  );
}
