import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildContactMailtoHref,
  CONTACT_GENERAL_VALIDATION_MESSAGE,
  CONTACT_REASON_OPTIONS,
  CONTACT_RATE_LIMIT_MESSAGE,
  CONTACT_SERVICE_UNAVAILABLE_MESSAGE,
  isTrustedContactOrigin,
  normalizeContactSubmission,
} from '@/lib/seveno-contact';
import {
  buildContactAcknowledgementEmailPreview,
  buildContactEmailPreview,
  CONTACT_ACKNOWLEDGEMENT_SUBJECT,
  CONTACT_RECIPIENT,
  queueContactEmail,
} from '@/lib/seveno-contact-email';
import { checkContactRateLimit, recordContactAttempt, resetContactRateLimitState } from '@/lib/seveno-contact-rate-limit';

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function assertContains(relativePath: string, fragments: string[]) {
  const source = readSource(relativePath);
  for (const fragment of fragments) {
    assert.match(source, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
}

function expectValidationError(input: unknown) {
  try {
    normalizeContactSubmission(input);
    assert.fail('Expected contact validation to fail.');
  } catch (error) {
    return error as Error & {
      code?: string;
      status?: number;
      fieldErrors?: Record<string, string>;
    };
  }
}

function createMockContactEmailTransport(options?: { failAcknowledgement?: boolean }) {
  const sentMainEmails: Array<ReturnType<typeof buildContactEmailPreview>> = [];
  const sentAcknowledgementEmails: Array<ReturnType<typeof buildContactAcknowledgementEmailPreview>> = [];

  return {
    sentMainEmails,
    sentAcknowledgementEmails,
    async sendMainEmail(preview: ReturnType<typeof buildContactEmailPreview>) {
      sentMainEmails.push(preview);
      return {
        accepted: true,
        messageId: `main-${sentMainEmails.length}`,
      };
    },
    async sendAcknowledgementEmail(preview: ReturnType<typeof buildContactAcknowledgementEmailPreview>) {
      if (options?.failAcknowledgement) {
        throw new Error('acknowledgement_failed');
      }

      sentAcknowledgementEmails.push(preview);
      return {
        accepted: true,
        messageId: `ack-${sentAcknowledgementEmails.length}`,
      };
    },
  };
}

async function main() {
  assert.equal(isTrustedContactOrigin(new Headers({ origin: 'https://seveno.eu' })), true);
  assert.equal(isTrustedContactOrigin(new Headers({ origin: 'https://www.seveno.eu' })), false);
  assert.equal(isTrustedContactOrigin(new Headers({ origin: 'https://example.com' })), false);
  assert.equal(isTrustedContactOrigin(new Headers({ referer: 'https://seveno.eu/contact' })), true);
  assert.equal(isTrustedContactOrigin(new Headers()), true);

  assert.equal(CONTACT_REASON_OPTIONS.length, 7);
  assert.deepEqual(
    CONTACT_REASON_OPTIONS.map((item) => item.label),
    [
      'Assistance candidat',
      'Demande d’accès entreprise',
      'Recommandation professionnelle',
      'Étude ou Observatoire',
      'Données personnelles et suppression',
      'Signaler un problème ou un comportement',
      'Autre demande',
    ],
  );

  const validSubmission = normalizeContactSubmission({
    name: 'Marie Dupont',
    email: 'marie.dupont@example.com',
    organization: 'UST Workflow',
    reason: 'acces-entreprise',
    subject: 'Besoin de contact',
    message: 'Bonjour, je souhaite échanger au sujet de la plateforme Seven’O.',
    renderedAtMs: Date.now(),
  });
  assert.equal(validSubmission.reason, 'acces-entreprise');
  assert.equal(validSubmission.organization, 'UST Workflow');

  const invalidEmail = expectValidationError({
    name: 'Marie Dupont',
    email: 'marie.dupont',
    organization: '',
    reason: 'assistance-candidat',
    subject: 'Besoin de contact',
    message: 'Bonjour, je souhaite échanger au sujet de la plateforme Seven’O.',
    renderedAtMs: Date.now(),
  });
  assert.equal(invalidEmail.code, 'validation_failed');
  assert.equal(invalidEmail.fieldErrors?.email, 'Adresse email invalide.');

  const missingOrganization = expectValidationError({
    name: 'Marie Dupont',
    email: 'marie.dupont@example.com',
    organization: '',
    reason: 'acces-entreprise',
    subject: 'Besoin de contact',
    message: 'Bonjour, je souhaite échanger au sujet de la plateforme Seven’O.',
    renderedAtMs: Date.now(),
  });
  assert.equal(
    missingOrganization.fieldErrors?.organization,
    'Ce champ est obligatoire pour une demande d’accès entreprise.',
  );

  const headerInjection = expectValidationError({
    name: 'Marie Dupont',
    email: 'marie.dupont@example.com',
    organization: '',
    reason: 'assistance-candidat',
    subject: 'Hello\r\nBcc:evil@example.com',
    message: 'Bonjour, je souhaite échanger au sujet de la plateforme Seven’O.',
    renderedAtMs: Date.now(),
  });
  assert.equal(headerInjection.fieldErrors?.subject, 'Les retours à la ligne ne sont pas autorisés dans ce champ.');

  const mailtoHref = buildContactMailtoHref(validSubmission);
  assert.match(mailtoHref, /^mailto:sebastien@seveno\.eu\?/);
  assert.match(mailtoHref, /subject=/);

  const context = {
    submission: validSubmission,
    requestId: 'contact-request-20260721-0001',
    receivedAt: new Date('2026-07-21T10:11:12.000Z'),
  };

  const emailPreview = buildContactEmailPreview(context);
  assert.equal(emailPreview.to, CONTACT_RECIPIENT);
  assert.equal(emailPreview.replyTo, 'marie.dupont@example.com');
  assert.equal(emailPreview.subject, "[Seven’O Contact] [Demande d’accès entreprise] Besoin de contact");
  assert.match(emailPreview.text, /Demande reçue depuis le formulaire Seven’O/);
  assert.match(emailPreview.text, /Identifiant de la demande : contact-request-20260721-0001/);
  assert.match(emailPreview.html, /Seven’O/);

  const acknowledgementPreview = buildContactAcknowledgementEmailPreview(context);
  assert.equal(acknowledgementPreview.to, 'marie.dupont@example.com');
  assert.equal(acknowledgementPreview.subject, CONTACT_ACKNOWLEDGEMENT_SUBJECT);
  assert.match(acknowledgementPreview.text, /Votre demande a bien été transmise à Seven’O\./);
  assert.match(acknowledgementPreview.text, /sebastien@seveno.eu/);
  assert.match(acknowledgementPreview.html, /sebastien@seveno.eu/);

  const transport = createMockContactEmailTransport();
  const queued = await queueContactEmail(context, { transport });
  assert.equal(queued.queued, true);
  assert.equal(queued.acknowledgementSent, true);
  assert.equal(queued.requestId, context.requestId);
  assert.equal(transport.sentMainEmails.length, 1);
  assert.equal(transport.sentAcknowledgementEmails.length, 1);
  assert.equal(transport.sentMainEmails[0]!.to, CONTACT_RECIPIENT);
  assert.equal(transport.sentMainEmails[0]!.replyTo, validSubmission.email);
  assert.match(
    transport.sentMainEmails[0]!.subject,
    /^\[Seven’O Contact\] \[Demande d’accès entreprise\] Besoin de contact$/,
  );
  assert.match(transport.sentMainEmails[0]!.text, /Répondez directement à cet email pour écrire au demandeur\./);
  assert.equal(transport.sentAcknowledgementEmails[0]!.to, validSubmission.email);

  const acknowledgementFailureTransport = createMockContactEmailTransport({ failAcknowledgement: true });
  const queuedWithoutAcknowledgement = await queueContactEmail(context, {
    transport: acknowledgementFailureTransport,
  });
  assert.equal(queuedWithoutAcknowledgement.queued, true);
  assert.equal(queuedWithoutAcknowledgement.acknowledgementSent, false);
  assert.equal(queuedWithoutAcknowledgement.requestId, context.requestId);

  const mainRejectedTransport = {
    async sendMainEmail() {
      return {
        accepted: false,
        messageId: 'rejected',
      };
    },
    async sendAcknowledgementEmail() {
      throw new Error('should not send acknowledgement when the main email fails');
    },
  };
  const rejectedDelivery = await queueContactEmail(context, {
    transport: mainRejectedTransport,
  });
  assert.equal(rejectedDelivery.queued, false);
  assert.equal(rejectedDelivery.reason, 'main_send_failed');

  const providerMissingDelivery = await queueContactEmail(context, {
    transport: null,
  });
  assert.equal(providerMissingDelivery.queued, false);
  assert.equal(providerMissingDelivery.reason, 'provider_missing');

  resetContactRateLimitState();
  for (let index = 0; index < 5; index += 1) {
    const allowed = checkContactRateLimit({
      origin: 'https://example.com',
      userAgent: 'Mozilla/5.0',
      email: 'contact@example.com',
      now: index,
    });
    assert.equal(allowed.allowed, true);
    recordContactAttempt({
      origin: 'https://example.com',
      userAgent: 'Mozilla/5.0',
      email: 'contact@example.com',
      now: index,
    });
  }

  const blockedByOrigin = checkContactRateLimit({
    origin: 'https://example.com',
    userAgent: 'Mozilla/5.0',
    email: 'contact@example.com',
    now: 10,
  });
  assert.equal(blockedByOrigin.allowed, false);
  assert.equal(blockedByOrigin.reason, 'origin');

  resetContactRateLimitState();
  for (let index = 0; index < 10; index += 1) {
    const allowed = checkContactRateLimit({
      origin: `https://example-${index}.com`,
      userAgent: 'Mozilla/5.0',
      email: 'same-email@example.com',
      now: index,
    });
    assert.equal(allowed.allowed, true);
    recordContactAttempt({
      origin: `https://example-${index}.com`,
      userAgent: 'Mozilla/5.0',
      email: 'same-email@example.com',
      now: index,
    });
  }

  const blockedByEmail = checkContactRateLimit({
    origin: 'https://example-11.com',
    userAgent: 'Mozilla/5.0',
    email: 'same-email@example.com',
    now: 20,
  });
  assert.equal(blockedByEmail.allowed, false);
  assert.equal(blockedByEmail.reason, 'email');

  assertContains('app/contact/page.tsx', [
    'Seven’O - Contact',
    'ContactHero',
    'ContactForm',
    'ContactInformation',
    'ContactFaq',
  ]);

  assertContains('components/public/contact/ContactHero.tsx', [
    'CONTACT',
    'Échanger avec Seven’O.',
    'sebastien@seveno.eu',
  ]);

  assertContains('components/public/contact/ContactForm.tsx', [
    'FORMULAIRE DE CONTACT',
    'Décrivez votre demande avec précision.',
    'Nom et prénom *',
    'Adresse email *',
    'Entreprise ou organisation',
    'Motif de la demande *',
    'Objet *',
    'Message *',
    'Décrivez votre question, le contexte rencontré et les informations utiles pour comprendre votre demande.',
    'Envoyer ma demande',
    'Envoi en cours…',
    'Consulter la Politique de confidentialité',
    'website',
    'renderedAtMs',
    'payload?.success',
    CONTACT_GENERAL_VALIDATION_MESSAGE,
  ]);

  assertContains('components/public/contact/ContactInformation.tsx', [
    'CONTACTER SEVEN’O',
    'Les informations utiles avant l’envoi.',
    'Adresse email',
    'Pour une demande candidat',
    'Pour un accès entreprise',
    'Pour une recommandation',
    'Sécurité',
  ]);

  assertContains('components/public/contact/ContactFaq.tsx', [
    'QUESTIONS FRÉQUENTES',
    'Avant de contacter Seven’O',
    'Comment demander un accès entreprise ?',
    'Je rencontre un problème avec mon compte candidat. Que dois-je indiquer ?',
    'Mon lien de recommandation ne fonctionne plus. Que faire ?',
    'Comment demander la suppression de mon compte ou exercer mes droits ?',
    'Comment signaler une offre, un message ou un comportement ?',
    'Puis-je transmettre un retour sur l’étude ou l’Observatoire ?',
  ]);

  assertContains('app/api/contact/route.ts', [
    'readJsonBody',
    'normalizeContactSubmission',
    'CONTACT_MIN_RENDER_DELAY_MS',
    'consumeSevenoRateLimits',
    "error: 'rate_limit_exceeded'",
    "'Retry-After'",
    "'rate_limit_unavailable'",
    'CONTACT_SERVICE_UNAVAILABLE_MESSAGE',
    'queueContactEmail',
    'buildContactMailtoHref',
    'website',
    'renderedAtMs',
    'MAX_CONTACT_BODY_CHARACTERS',
    'unsupported_media_type',
    'invalid_origin',
    'provider_missing',
    'send_failed',
    'requestId',
    'acknowledgementSent',
    'success',
  ]);

  assertContains('lib/seveno-contact-email.ts', [
    'CONTACT_RECIPIENT',
    'CONTACT_SENDER_NAME',
    'CONTACT_ACKNOWLEDGEMENT_SUBJECT',
    'replyTo: submission.email',
    'requestId',
    'acknowledgementSent',
    'buildContactAcknowledgementEmailPreview',
    'Seven’O — Formulaire de contact',
    'Seven’O — Votre demande a bien été reçue',
    'Répondez directement à cet email pour écrire au demandeur.',
  ]);

  assertContains('lib/seveno-contact-rate-limit.ts', [
    'MAX_ORIGIN_ATTEMPTS_PER_HOUR',
    'MAX_EMAIL_ATTEMPTS_PER_DAY',
    'buildContactOriginKey',
    'buildContactEmailKey',
  ]);

  assertContains('lib/seveno-contact.ts', [
    'CONTACT_REASON_OPTIONS',
    'assistance-candidat',
    'acces-entreprise',
    'recommandation',
    'etude',
    'donnees-personnelles',
    'signalement',
    'autre',
    'CONTACT_GENERAL_VALIDATION_MESSAGE',
    'CONTACT_RATE_LIMIT_MESSAGE',
    'CONTACT_SERVICE_UNAVAILABLE_MESSAGE',
    'buildContactMailtoHref',
  ]);

  console.log('SevenO contact smoke test: OK');
}

void main();
