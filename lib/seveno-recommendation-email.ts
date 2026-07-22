import 'server-only';

import type { CandidateRecommendationRequest } from '@/types/seveno';

export interface RecommendationInvitationEmailPreview {
  subject: string;
  text: string;
  html: string;
}

export function buildRecommendationInvitationEmailPreview(
  request: CandidateRecommendationRequest,
  publicLink: string | null,
): RecommendationInvitationEmailPreview {
  const fullName = `${request.respondentFirstName} ${request.respondentLastName}`.trim();
  const subject = `Seven’O - Demande de recommandation`;
  const linkLine = publicLink
    ? `Lien sécurisé: ${publicLink}`
    : 'Le lien sécurisé est conservé côté serveur dans cette configuration.';
  const text = [
    `Bonjour ${fullName || 'vous'},`,
    '',
    `Une demande de recommandation Seven’O a été préparée pour ${request.publicCandidateId}.`,
    `Contexte: ${request.respondentTitle} · ${request.respondentCompanyName}.`,
    linkLine,
    '',
    `Poste: ${request.candidateJobTitle}.`,
    `Période: ${request.collaborationPeriodLabel}.`,
  ].join('\n');

  const html = [
    `<p>Bonjour ${fullName || 'vous'},</p>`,
    `<p>Une demande de recommandation Seven’O a été préparée pour <strong>${request.publicCandidateId}</strong>.</p>`,
    `<p>Contexte: ${request.respondentTitle} · ${request.respondentCompanyName}.</p>`,
    `<p>${linkLine}</p>`,
    `<p>Poste: ${request.candidateJobTitle}.</p>`,
    `<p>Période: ${request.collaborationPeriodLabel}.</p>`,
  ].join('');

  return {
    subject,
    text,
    html,
  };
}

export async function queueRecommendationInvitationEmail(
  preview: RecommendationInvitationEmailPreview,
): Promise<{ queued: false }> {
  void preview;
  return { queued: false };
}
