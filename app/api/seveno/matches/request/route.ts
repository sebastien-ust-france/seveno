import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { requireActiveCompanyMembership } from '@/lib/seveno-company-memberships-server';
import { createSevenoMatchRequest, getSevenoUserByUid, SevenoMatchRequestError } from '@/lib/seveno-match-requests';
import { readJsonBody, toMatchApiErrorResponse } from '../_shared';
import type { MatchRequestContractType } from '@/types/seveno';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MATCH_REQUEST_CONTRACT_TYPES: MatchRequestContractType[] = [
  'permanent',
  'fixed_term',
  'temporary',
  'freelance',
  'apprenticeship',
  'internship',
  'other',
];

function normalizeOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const cleaned = value.trim();
  if (cleaned.length === 0) {
    return undefined;
  }

  if (cleaned.length > maxLength) {
    throw new SevenoMatchRequestError('invalid_payload', 400, 'Un champ texte contient trop de caracteres.');
  }

  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(decodedToken.uid);

    if (!actor || actor.role !== 'company') {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Seules les entreprises peuvent envoyer une demande.');
    }

    const body = await readJsonBody(request);
    if (!body) {
      return NextResponse.json(
        {
          error: 'invalid_payload',
          message: 'Le contenu envoye est invalide.',
        },
        { status: 400 },
      );
    }

    const publicCandidateId = typeof body.publicCandidateId === 'string' ? body.publicCandidateId.trim() : '';
    if (!publicCandidateId) {
      return NextResponse.json(
        {
          error: 'missing_public_candidate_id',
          message: 'L identifiant public du candidat est manquant.',
        },
        { status: 400 },
      );
    }

    const proposedJobTitle = normalizeOptionalText(body.proposedJobTitle, 120);
    const proposedLocation = normalizeOptionalText(body.proposedLocation, 120);
    const message = normalizeOptionalText(body.message, 500);
    const contractType =
      typeof body.contractType === 'string' && MATCH_REQUEST_CONTRACT_TYPES.includes(body.contractType as MatchRequestContractType)
        ? (body.contractType as MatchRequestContractType)
        : undefined;

    const membership = await requireActiveCompanyMembership({ userUid: decodedToken.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin'] });
    const payload = await createSevenoMatchRequest({
      companyUid: membership.companyId,
      publicCandidateId,
      proposedJobTitle,
      proposedLocation,
      contractType,
      message,
    });

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return toMatchApiErrorResponse(error);
  }
}
