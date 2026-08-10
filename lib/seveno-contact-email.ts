import 'server-only';

import { createTransport } from 'nodemailer';
import { getContactReasonLabel, type ContactSubmission } from '@/lib/seveno-contact';

export const CONTACT_RECIPIENT = 'sebastien@seveno.eu';
export const CONTACT_SENDER_NAME = 'Seven’O — Formulaire de contact';
export const CONTACT_ACKNOWLEDGEMENT_SUBJECT = 'Seven’O — Votre demande a bien été reçue';

export interface ContactEmailPreview {
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
}

export interface ContactAcknowledgementEmailPreview {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type ContactMailMessage = ContactEmailPreview | ContactAcknowledgementEmailPreview;

export type ContactMailSendResult = {
  accepted: boolean;
  messageId?: string;
};

export type ContactMailTransport = {
  sendMainEmail(preview: ContactEmailPreview): Promise<ContactMailSendResult>;
  sendAcknowledgementEmail(preview: ContactAcknowledgementEmailPreview): Promise<ContactMailSendResult>;
};

export type ContactEmailQueueResult = {
  queued: boolean;
  acknowledgementSent: boolean;
  requestId: string;
  reason?: 'provider_missing' | 'main_send_failed';
  mainMessageId?: string;
  acknowledgementMessageId?: string;
};

type ContactEmailContext = {
  submission: ContactSubmission;
  requestId: string;
  receivedAt: Date;
};

type ContactSmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromAddress: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatReceivedAt(receivedAt: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(receivedAt);
}

function normalizeText(value: string) {
  return value.trim();
}

function buildMainSubject(submission: ContactSubmission) {
  const reasonLabel = getContactReasonLabel(submission.reason);
  return `[Seven’O Contact] [${reasonLabel}] ${normalizeText(submission.subject)}`;
}

function buildContactBodyLines(context: ContactEmailContext) {
  const { submission, requestId, receivedAt } = context;

  return [
    'Demande reçue depuis le formulaire Seven’O',
    '',
    `Nom et prénom : ${submission.name}`,
    `Adresse email : ${submission.email}`,
    `Entreprise ou organisation : ${submission.organization || 'Non renseignée'}`,
    `Motif : ${getContactReasonLabel(submission.reason)}`,
    `Objet : ${submission.subject}`,
    '',
    'Message :',
    submission.message,
    '',
    `Date de réception : ${formatReceivedAt(receivedAt)}`,
    `Identifiant de la demande : ${requestId}`,
    '',
    'Répondez directement à cet email pour écrire au demandeur.',
  ];
}

function buildAcknowledgementBodyLines(context: ContactEmailContext) {
  const { submission } = context;

  return [
    'Bonjour,',
    '',
    'Votre demande a bien été transmise à Seven’O.',
    '',
    `Objet : ${submission.subject}`,
    '',
    `Motif : ${getContactReasonLabel(submission.reason)}`,
    '',
    'Nous disposons désormais des informations nécessaires pour l’examiner. Des précisions complémentaires pourront vous être demandées si elles sont nécessaires au traitement.',
    '',
    'Cordialement,',
    '',
    'Seven’O',
    'Recrutement et observatoire des talents',
    'sebastien@seveno.eu',
  ];
}

function buildContactHtml(lines: string[]) {
  const [introduction, ...rest] = lines;
  const body = rest
    .map((line) => {
      if (!line) {
        return '<div style="height:12px"></div>';
      }

      return `<p style="margin:0 0 12px">${escapeHtml(line).replace(/\r?\n/g, '<br />')}</p>`;
    })
    .join('');

  return [
    `<p style="margin:0 0 16px">${escapeHtml(introduction)}</p>`,
    body,
  ].join('');
}

function buildContactSmtpConfig(): ContactSmtpConfig | null {
  const host = process.env.CONTACT_SMTP_HOST?.trim() ?? '';
  const portText = process.env.CONTACT_SMTP_PORT?.trim() ?? '';
  const user = process.env.CONTACT_SMTP_USER?.trim() ?? '';
  const password = process.env.CONTACT_SMTP_PASSWORD ?? '';
  const fromAddress = process.env.CONTACT_SMTP_FROM_ADDRESS?.trim() ?? '';

  if (!host || !portText || !user || !password || !fromAddress) {
    return null;
  }

  const port = Number.parseInt(portText, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromAddress)) {
    return null;
  }

  return {
    host,
    port,
    secure: process.env.CONTACT_SMTP_SECURE === 'true' ? true : port === 465,
    user,
    password,
    fromAddress,
  };
}

function formatSenderAddress(config: ContactSmtpConfig) {
  return `${CONTACT_SENDER_NAME} <${config.fromAddress}>`;
}

function buildSmtpTransport() {
  const config = buildContactSmtpConfig();
  if (!config) {
    return null;
  }

  const transporter = createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });

  const from = formatSenderAddress(config);

  return {
    async sendMainEmail(preview: ContactEmailPreview): Promise<ContactMailSendResult> {
      const result = await transporter.sendMail({
        from,
        to: preview.to,
        replyTo: preview.replyTo,
        subject: preview.subject,
        text: preview.text,
        html: preview.html,
      });

      return {
        accepted: Array.isArray(result.accepted) ? result.accepted.length > 0 : true,
        messageId: typeof result.messageId === 'string' ? result.messageId : undefined,
      };
    },
    async sendAcknowledgementEmail(preview: ContactAcknowledgementEmailPreview): Promise<ContactMailSendResult> {
      const result = await transporter.sendMail({
        from,
        to: preview.to,
        subject: preview.subject,
        text: preview.text,
        html: preview.html,
      });

      return {
        accepted: Array.isArray(result.accepted) ? result.accepted.length > 0 : true,
        messageId: typeof result.messageId === 'string' ? result.messageId : undefined,
      };
    },
  } satisfies ContactMailTransport;
}

let cachedDefaultTransport: ContactMailTransport | null | undefined;

function getDefaultContactMailTransport() {
  if (cachedDefaultTransport !== undefined) {
    return cachedDefaultTransport;
  }

  cachedDefaultTransport = buildSmtpTransport();
  return cachedDefaultTransport;
}

export function buildContactEmailPreview(context: ContactEmailContext): ContactEmailPreview {
  const { submission, requestId, receivedAt } = context;
  const lines = buildContactBodyLines({
    submission,
    requestId,
    receivedAt,
  });

  return {
    to: CONTACT_RECIPIENT,
    replyTo: submission.email,
    subject: buildMainSubject(submission),
    text: lines.join('\n'),
    html: buildContactHtml(lines),
  };
}

export function buildContactAcknowledgementEmailPreview(context: ContactEmailContext): ContactAcknowledgementEmailPreview {
  const lines = buildAcknowledgementBodyLines(context);

  return {
    to: context.submission.email,
    subject: CONTACT_ACKNOWLEDGEMENT_SUBJECT,
    text: lines.join('\n'),
    html: buildContactHtml(lines),
  };
}

export async function queueContactEmail(
  context: ContactEmailContext,
  options?: {
    transport?: ContactMailTransport | null;
  },
): Promise<ContactEmailQueueResult> {
  const transport = options?.transport ?? getDefaultContactMailTransport();
  if (!transport) {
    return {
      queued: false,
      acknowledgementSent: false,
      requestId: context.requestId,
      reason: 'provider_missing',
    };
  }

  const mainPreview = buildContactEmailPreview(context);
  let mainResult: ContactMailSendResult;

  try {
    mainResult = await transport.sendMainEmail(mainPreview);
  } catch (error) {
    console.error('[POST /api/contact] Échec de l’envoi principal', {
      requestId: context.requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      queued: false,
      acknowledgementSent: false,
      requestId: context.requestId,
      reason: 'main_send_failed',
    };
  }

  if (!mainResult.accepted) {
    return {
      queued: false,
      acknowledgementSent: false,
      requestId: context.requestId,
      reason: 'main_send_failed',
      mainMessageId: mainResult.messageId,
    };
  }

  let acknowledgementSent = false;
  let acknowledgementMessageId: string | undefined;

  try {
    const acknowledgementPreview = buildContactAcknowledgementEmailPreview(context);
    const acknowledgementResult = await transport.sendAcknowledgementEmail(acknowledgementPreview);
    acknowledgementSent = acknowledgementResult.accepted;
    acknowledgementMessageId = acknowledgementResult.messageId;
  } catch (error) {
    console.warn('[POST /api/contact] Accusé de réception non envoyé', {
      requestId: context.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    queued: true,
    acknowledgementSent,
    requestId: context.requestId,
    mainMessageId: mainResult.messageId,
    ...(acknowledgementMessageId ? { acknowledgementMessageId } : {}),
  };
}
