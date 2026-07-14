import { NextRequest, NextResponse } from 'next/server';
import { processAvailabilityRemindersBatch, SevenoAvailabilityError } from '@/lib/seveno-candidate-availability-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readCronSecret() {
  return process.env.SEVENO_AVAILABILITY_CRON_SECRET?.trim() ?? '';
}

function isValidCronSecret(request: NextRequest) {
  const secret = readCronSecret();
  if (!secret) {
    return false;
  }

  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const bearerPrefix = 'Bearer ';
  if (!authorization.startsWith(bearerPrefix)) {
    return false;
  }

  return authorization.slice(bearerPrefix.length).trim() === secret;
}

function toAvailabilityErrorResponse(error: unknown) {
  if (error instanceof SevenoAvailabilityError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      error: 'unexpected_error',
      message: error instanceof Error ? error.message : 'Le traitement planifie est temporairement indisponible.',
    },
    { status: 500 },
  );
}

async function handleRequest(request: NextRequest) {
  if (!isValidCronSecret(request)) {
    return NextResponse.json(
      {
        error: 'forbidden',
        message: 'Le secret de planification est invalide.',
      },
      { status: 401 },
    );
  }

  const cursor = request.nextUrl.searchParams.get('cursor');
  const result = await processAvailabilityRemindersBatch(cursor);
  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  try {
    return await handleRequest(request);
  } catch (error) {
    return toAvailabilityErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handleRequest(request);
  } catch (error) {
    return toAvailabilityErrorResponse(error);
  }
}
