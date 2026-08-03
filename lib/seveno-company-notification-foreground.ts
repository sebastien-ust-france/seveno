export interface CompanyApplicationForegroundNotification {
  kind: 'company_application_submitted';
  title: string;
  body: string;
  applicationId: string;
  offerId: string;
  clickUrl: string;
  payloadVersion: string;
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildCompanyApplicationClickUrl(applicationId: string) {
  return `/entreprise/demandes/${encodeURIComponent(applicationId)}`;
}

export function isValidCompanyApplicationClickUrl(clickUrl: string, applicationId: string) {
  if (!clickUrl.startsWith('/') || clickUrl.startsWith('//')) {
    return false;
  }

  return clickUrl === buildCompanyApplicationClickUrl(applicationId);
}

export function parseCompanyApplicationForegroundNotification(
  data: Record<string, unknown> | undefined,
  notification: { title?: string | null; body?: string | null } | undefined,
): CompanyApplicationForegroundNotification | null {
  if (data?.kind !== 'company_application_submitted') {
    return null;
  }

  const applicationId = cleanText(data.applicationId);
  const offerId = cleanText(data.offerId);
  const clickUrl = cleanText(data.clickUrl);
  const payloadVersion = cleanText(data.payloadVersion);
  if (!applicationId || !offerId || !payloadVersion || !isValidCompanyApplicationClickUrl(clickUrl, applicationId)) {
    return null;
  }

  return {
    kind: 'company_application_submitted',
    title: cleanText(notification?.title) || 'Nouvelle candidature reçue',
    body: cleanText(notification?.body) || 'Un candidat vient de postuler à l’une de vos offres.',
    applicationId,
    offerId,
    clickUrl,
    payloadVersion,
  };
}
