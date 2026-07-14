import type { ReactNode } from 'react';
import AdminBootstrapGate from '@/components/admin/AdminBootstrapGate';
import { AuthenticatedAppShell } from '@/components/navigation/AuthenticatedAppShell';
import { ADMIN_NAVIGATION } from '@/lib/seveno-navigation';
import { getSevenoAdminSessionFromCookies } from '@/lib/seveno-admin-auth';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSevenoAdminSessionFromCookies();

  if (!session) {
    return <AdminBootstrapGate />;
  }

  return (
    <AuthenticatedAppShell
      eyebrow="Administration Seven'O"
      title="Navigation administration"
      description="Supervisez les comptes, les tests, les demandes de mise en relation et le journal interne."
      navigation={ADMIN_NAVIGATION}
      role="admin"
      footerNote={`Connecte en tant que ${session.user.email}`}
    >
      {children}
    </AuthenticatedAppShell>
  );
}
