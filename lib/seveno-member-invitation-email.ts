import 'server-only';

import { createTransport } from 'nodemailer';
import { COMPANY_ROLE_PRESENTATION } from '@/lib/seveno-company-roles';
import type { CompanyMembershipRole } from '@/types/seveno-billing';

export type MemberInvitationEmailResult = { sent: boolean; reason?: 'provider_missing' | 'send_failed' };

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function sendMemberInvitationEmail(input: { to: string; companyName: string; role: CompanyMembershipRole; invitationUrl: string }): Promise<MemberInvitationEmailResult> {
  const host = process.env.CONTACT_SMTP_HOST?.trim() ?? '';
  const port = Number.parseInt(process.env.CONTACT_SMTP_PORT?.trim() ?? '', 10);
  const user = process.env.CONTACT_SMTP_USER?.trim() ?? '';
  const password = process.env.CONTACT_SMTP_PASSWORD ?? '';
  const fromAddress = process.env.CONTACT_SMTP_FROM_ADDRESS?.trim() ?? '';
  if (!host || !Number.isInteger(port) || !user || !password || !fromAddress) return { sent: false, reason: 'provider_missing' };

  const roleLabel = COMPANY_ROLE_PRESENTATION[input.role].label;
  const text = `${input.companyName} vous invite à rejoindre son espace Seven’O.\n\nVotre accès :\n${roleLabel}\n\nCréer ou ouvrir mon accès Seven’O :\n${input.invitationUrl}\n\nCette invitation est personnelle et valable 7 jours.`;
  const html = `<p>${escapeHtml(input.companyName)} vous invite à rejoindre son espace Seven’O.</p><p>Votre accès :<br><strong>${escapeHtml(roleLabel)}</strong></p><p><a href="${escapeHtml(input.invitationUrl)}">Créer ou ouvrir mon accès Seven’O</a></p><p>Cette invitation est personnelle et valable 7 jours.</p>`;
  try {
    const transport = createTransport({ host, port, secure: process.env.CONTACT_SMTP_SECURE === 'true' ? true : port === 465, auth: { user, pass: password } });
    await transport.sendMail({ from: `Seven’O <${fromAddress}>`, to: input.to, subject: `Invitation à rejoindre ${input.companyName} sur Seven’O`, text, html });
    return { sent: true };
  } catch (error) {
    console.error('[member-invitation-email] Envoi impossible', { error: error instanceof Error ? error.message : String(error) });
    return { sent: false, reason: 'send_failed' };
  }
}
