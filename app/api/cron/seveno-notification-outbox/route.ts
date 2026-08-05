import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { processCompanyNotificationOutboxBatch } from '@/lib/seveno-company-notifications-server';
import {
  processCandidateOfferFanoutBatch,
  processCandidateOfferNotificationOutboxBatch,
} from '@/lib/seveno-candidate-offer-notifications-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest) {
  const secret = process.env.SEVENO_NOTIFICATION_OUTBOX_CRON_SECRET?.trim() ?? '';
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const supplied = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
  if (!secret || !supplied) {
    return false;
  }
  const expectedBuffer = Buffer.from(secret, 'utf8');
  const suppliedBuffer = Buffer.from(supplied, 'utf8');
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const [fanouts, companyEvents, candidateEvents] = await Promise.all([
    processCandidateOfferFanoutBatch({ limit: 3 }),
    processCompanyNotificationOutboxBatch({ limit: 20 }),
    processCandidateOfferNotificationOutboxBatch({ limit: 20 }),
  ]);
  return NextResponse.json({ fanouts, companyEvents, candidateEvents });
}
