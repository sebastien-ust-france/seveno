import type { Metadata } from 'next';
import { MemberInvitationAccess } from '@/components/invitation/MemberInvitationAccess';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Invitation membre Seven’O', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default function MemberInvitationPage() {
  return <MemberInvitationAccess />;
}
