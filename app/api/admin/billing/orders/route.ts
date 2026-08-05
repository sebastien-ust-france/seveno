import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest } from '@/lib/seveno-admin-auth';
import { applyAdministrativeCreditAdjustment, createManualBillingOrder, SevenoBillingError } from '@/lib/seveno-billing-server';
import type { BillingProductCode } from '@/types/seveno-billing';
import { readJsonBody, toAdminApiErrorResponse } from '../../_shared';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  try {
    await requireSevenoAdminSessionFromRequest(request);
    const firestore = adminDb;
    if (!firestore) throw new Error('Firebase Admin indisponible.');
    const [accounts, campaigns, orders] = await Promise.all([
      firestore.collection('company_billing_accounts').limit(100).get(),
      firestore.collection('recruitment_campaigns').orderBy('updatedAt', 'desc').limit(100).get(),
      firestore.collection('billing_orders').orderBy('createdAt', 'desc').limit(100).get(),
    ]);
    const companyIds = [...new Set(accounts.docs.map((doc) => doc.id))];
    const profiles = companyIds.length ? await firestore.getAll(...companyIds.map((id) => firestore.collection('company_profiles').doc(id))) : [];
    const serialize = (doc: FirebaseFirestore.DocumentSnapshot) => ({
      id: doc.id, ...doc.data(),
      createdAt: doc.get('createdAt')?.toDate?.().toISOString() ?? null,
      updatedAt: doc.get('updatedAt')?.toDate?.().toISOString() ?? null,
      startedAt: doc.get('startedAt')?.toDate?.().toISOString() ?? null,
      endsAt: doc.get('endsAt')?.toDate?.().toISOString() ?? null,
    });
    return NextResponse.json({
      accounts: accounts.docs.map((doc, index) => ({ ...serialize(doc), companyName: profiles[index]?.get('companyName') ?? '' })),
      campaigns: campaigns.docs.map(serialize), orders: orders.docs.map(serialize),
    });
  } catch (error) { return toAdminApiErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const session = await requireSevenoAdminSessionFromRequest(request);
    const body = await readJsonBody(request);
    if (body?.operation === 'restoration' || body?.operation === 'correction') {
      if (typeof body.companyId !== 'string' || typeof body.quantity !== 'number' || typeof body.reason !== 'string' || typeof body.idempotencyKey !== 'string') {
        throw new SevenoBillingError('invalid_adjustment', 400, 'Ajustement manuel invalide.');
      }
      return NextResponse.json(await applyAdministrativeCreditAdjustment({ companyId: body.companyId, quantity: body.quantity, kind: body.operation, actorUid: session.user.uid, reason: body.reason, idempotencyKey: body.idempotencyKey }));
    }
    if (!body || typeof body.companyId !== 'string' || typeof body.productCode !== 'string' || typeof body.reason !== 'string' || typeof body.idempotencyKey !== 'string') {
      throw new SevenoBillingError('invalid_order', 400, 'Commande manuelle invalide.');
    }
    return NextResponse.json(await createManualBillingOrder({ companyId: body.companyId, productCode: body.productCode as BillingProductCode, ...(typeof body.campaignId === 'string' ? { campaignId: body.campaignId } : {}), actorUid: session.user.uid, reason: body.reason, idempotencyKey: body.idempotencyKey }));
  } catch (error) {
    if (error instanceof SevenoBillingError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return toAdminApiErrorResponse(error);
  }
}
