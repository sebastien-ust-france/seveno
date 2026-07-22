import type { Metadata } from 'next';
import { PublicSiteShell } from '@/components/public/PublicSiteShell';
import { MentionsLegalesContent } from '@/components/public/legal/MentionsLegalesContent';

export const metadata: Metadata = {
  title: "Mentions légales — Seven’O",
  description:
    "Consultez les informations légales relatives à Seven’O, à son éditeur UST-WORKFLOW, à son directeur de publication et à son hébergement.",
  alternates: {
    canonical: '/mentions-legales',
  },
};

export default function MentionsLegalesPage() {
  return (
    <PublicSiteShell>
      <MentionsLegalesContent />
    </PublicSiteShell>
  );
}
