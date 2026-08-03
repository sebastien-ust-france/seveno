import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthenticatedAppShell } from '@/components/navigation/AuthenticatedAppShell';
import { CompanyNotificationCenter } from '@/components/entreprise/CompanyNotificationCenter';
import { COMPANY_NAVIGATION } from '@/lib/seveno-navigation';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function EntrepriseLayout({ children }: { children: ReactNode }) {
  return (
    <AuthenticatedAppShell
      eyebrow="Espace entreprise"
      title="Navigation entreprise"
      description="Consultez vos offres, vos mises en relation et le profil anonyme de vos candidats."
      navigation={COMPANY_NAVIGATION}
      role="company"
      footerNote="Les données privées des candidats restent toujours hors de portée avant acceptation explicite."
    >
      <CompanyNotificationCenter />
      {children}
    </AuthenticatedAppShell>
  );
}
