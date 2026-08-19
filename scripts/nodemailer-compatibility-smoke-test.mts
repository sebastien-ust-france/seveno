import assert from 'node:assert/strict';
import { createTransport } from 'nodemailer';
import { normalizeContactSubmission } from '@/lib/seveno-contact';
import {
  buildContactAcknowledgementEmailPreview,
  buildContactEmailPreview,
  CONTACT_SENDER_NAME,
} from '@/lib/seveno-contact-email';

const submission = normalizeContactSubmission({
  name: 'Marie Dupont',
  email: 'marie.dupont@example.com',
  organization: 'UST Workflow',
  reason: 'acces-entreprise',
  subject: 'Besoin de contact',
  message: 'Bonjour, je souhaite échanger au sujet de la plateforme Seven’O.',
  renderedAtMs: Date.now(),
});
const context = {
  submission,
  requestId: 'nodemailer-compatibility-20260819',
  receivedAt: new Date('2026-08-19T10:11:12.000Z'),
};
const main = buildContactEmailPreview(context);
const acknowledgement = buildContactAcknowledgementEmailPreview(context);
const from = `${CONTACT_SENDER_NAME} <sender@example.com>`;
const transport = createTransport({
  streamTransport: true,
  buffer: true,
  newline: 'unix',
});

const mainResult = await transport.sendMail({
  from,
  to: main.to,
  replyTo: main.replyTo,
  subject: main.subject,
  text: main.text,
  html: main.html,
});
const mainMessage = Buffer.isBuffer(mainResult.message)
  ? mainResult.message.toString('utf8')
  : String(mainResult.message);
assert.deepEqual(mainResult.envelope.to, ['sebastien@seveno.eu']);
assert.match(mainMessage, /To: sebastien@seveno\.eu/i);
assert.match(mainMessage, /Reply-To: marie\.dupont@example\.com/i);
assert.match(mainMessage, /Content-Type: multipart\/alternative/i);
assert.match(mainMessage, /nodemailer-compatibility-20260819/);

const acknowledgementResult = await transport.sendMail({
  from,
  to: acknowledgement.to,
  subject: acknowledgement.subject,
  text: acknowledgement.text,
  html: acknowledgement.html,
});
const acknowledgementMessage = Buffer.isBuffer(acknowledgementResult.message)
  ? acknowledgementResult.message.toString('utf8')
  : String(acknowledgementResult.message);
assert.deepEqual(acknowledgementResult.envelope.to, ['marie.dupont@example.com']);
assert.match(acknowledgementMessage, /To: marie\.dupont@example\.com/i);
assert.match(acknowledgementMessage, /Content-Type: multipart\/alternative/i);
assert.ok(mainResult.messageId);
assert.ok(acknowledgementResult.messageId);

console.log('Nodemailer compatibility smoke test: OK', {
  mainMessageId: mainResult.messageId,
  acknowledgementMessageId: acknowledgementResult.messageId,
});
