import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest, SevenoAdminAuthError } from '@/lib/seveno-admin-auth';
import {
  SevenoAssessmentAdminError,
  archiveSevenoAssessmentVersion,
  analyzeSevenoAssessmentImportJson,
  createSevenoAssessmentBlankDraft,
  deleteSevenoAssessmentUnusedDraft,
  deleteSevenoAssessmentVersion,
  duplicateSevenoAssessmentVersion,
  generateSevenoAssessmentPrompt,
  handleSevenoAssessmentRepositoryError,
  importSevenoAssessmentVersion,
  loadSevenoAssessmentEditorState,
  markSevenoAssessmentAsPilot,
  previewSevenoAssessmentCandidateVersion,
  previewSevenoAssessmentVersion,
  publishSevenoAssessmentVersion,
  readSevenoAssessmentVersion,
  updateSevenoAssessmentDraft,
  validateSevenoAssessmentDraft,
} from '@/lib/seveno-professional-assessment-admin-server';
import type { SevenoAssessmentStoredVersion } from '@/types/seveno-assessment-admin';
import { readJsonBody } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'Cache-Control': 'no-store',
    },
  });
}

function toAssessmentAdminApiErrorResponse(error: unknown) {
  if (error instanceof SevenoAdminAuthError || error instanceof SevenoAssessmentAdminError) {
    return jsonNoStore(
      {
        error: error.code,
        message: error.message,
      },
      { status: error.status },
    );
  }

  const normalized = handleSevenoAssessmentRepositoryError(error);
  return jsonNoStore(normalized.body, { status: normalized.status });
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSevenoAdminSessionFromRequest(request);
    const selectedVersionId = request.nextUrl.searchParams.get('versionId');
    const payload = await loadSevenoAssessmentEditorState(session, selectedVersionId);
    return jsonNoStore(payload);
  } catch (error) {
    return toAssessmentAdminApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSevenoAdminSessionFromRequest(request);
    const body = await readJsonBody(request);
    const action = typeof body?.action === 'string' ? body.action : '';

    switch (action) {
      case 'load':
        return jsonNoStore(await loadSevenoAssessmentEditorState(session, typeof body?.versionId === 'string' ? body.versionId : undefined));
      case 'read_version':
        return jsonNoStore(await readSevenoAssessmentVersion(session, typeof body?.versionId === 'string' ? body.versionId : ''));
      case 'create_blank_draft':
        return jsonNoStore(await createSevenoAssessmentBlankDraft(session));
      case 'duplicate_version':
        return jsonNoStore(await duplicateSevenoAssessmentVersion(session, typeof body?.versionId === 'string' ? body.versionId : ''));
      case 'update_draft':
        return jsonNoStore(await updateSevenoAssessmentDraft(
          session,
          typeof body?.versionId === 'string' ? body.versionId : '',
          body?.version && typeof body.version === 'object' ? body.version as SevenoAssessmentStoredVersion : ({} as SevenoAssessmentStoredVersion),
        ));
      case 'delete_unused_draft':
        return jsonNoStore(await deleteSevenoAssessmentUnusedDraft(
          session,
          typeof body?.versionId === 'string' ? body.versionId : '',
          typeof body?.revisionNumber === 'number' ? body.revisionNumber : undefined,
        ));
      case 'delete_version':
        return jsonNoStore(await deleteSevenoAssessmentVersion(
          session,
          typeof body?.versionId === 'string' ? body.versionId : '',
          typeof body?.revisionNumber === 'number' ? body.revisionNumber : undefined,
        ));
      case 'validate_draft':
        return jsonNoStore(await validateSevenoAssessmentDraft(
          session,
          body?.version && typeof body.version === 'object' ? body.version as SevenoAssessmentStoredVersion : ({} as SevenoAssessmentStoredVersion),
        ));
      case 'generate_prompt':
        return jsonNoStore(await generateSevenoAssessmentPrompt(
          session,
          body?.version && typeof body.version === 'object' ? body.version as SevenoAssessmentStoredVersion : ({} as SevenoAssessmentStoredVersion),
        ));
      case 'preview_version':
        return jsonNoStore(await previewSevenoAssessmentVersion(
          session,
          body?.version && typeof body.version === 'object' ? body.version as SevenoAssessmentStoredVersion : ({} as SevenoAssessmentStoredVersion),
          body?.mode === 'extended' || body?.mode === 'complementary' ? body.mode : 'essential',
        ));
      case 'preview_candidate_version':
        return jsonNoStore(await previewSevenoAssessmentCandidateVersion(
          session,
          body?.version && typeof body.version === 'object' ? body.version as SevenoAssessmentStoredVersion : ({} as SevenoAssessmentStoredVersion),
          typeof body?.seed === 'string' ? body.seed : undefined,
        ));
      case 'mark_as_pilot':
        return jsonNoStore(await markSevenoAssessmentAsPilot(
          session,
          typeof body?.versionId === 'string' ? body.versionId : '',
          typeof body?.revisionNumber === 'number' ? body.revisionNumber : undefined,
        ));
      case 'publish_version':
        return jsonNoStore(await publishSevenoAssessmentVersion(
          session,
          typeof body?.versionId === 'string' ? body.versionId : '',
          typeof body?.revisionNumber === 'number' ? body.revisionNumber : undefined,
        ));
      case 'archive_version':
        return jsonNoStore(await archiveSevenoAssessmentVersion(
          session,
          typeof body?.versionId === 'string' ? body.versionId : '',
          typeof body?.revisionNumber === 'number' ? body.revisionNumber : undefined,
        ));
      case 'import_json':
        return jsonNoStore(await importSevenoAssessmentVersion(session, typeof body?.jsonText === 'string' ? body.jsonText : ''));
      case 'analyze_import_json':
        return jsonNoStore(await analyzeSevenoAssessmentImportJson(session, typeof body?.jsonText === 'string' ? body.jsonText : ''));
      default:
        return jsonNoStore(
          { error: 'invalid_action', message: 'Action admin invalide.' },
          { status: 400 },
        );
    }
  } catch (error) {
    return toAssessmentAdminApiErrorResponse(error);
  }
}
