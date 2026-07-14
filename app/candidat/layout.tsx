import type { ReactNode } from 'react';
import { CandidateSidebarIdentity } from '@/components/navigation/CandidateSidebarIdentity';
import { AuthenticatedAppShell } from '@/components/navigation/AuthenticatedAppShell';
import { CANDIDATE_NAVIGATION } from '@/lib/seveno-navigation';

export default function CandidateLayout({ children }: { children: ReactNode }) {
  return (
    <AuthenticatedAppShell
      eyebrow="Espace candidat"
      title=""
      description=""
      navigation={CANDIDATE_NAVIGATION}
      role="candidate"
      sidebarTop={<CandidateSidebarIdentity />}
    >
      {children}
    </AuthenticatedAppShell>
  );
}
