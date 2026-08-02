import type { Metadata } from 'next';
import { PublicSiteShell } from '@/components/public/PublicSiteShell';
import { ObservatoryFindings } from '@/components/public/observatory/ObservatoryFindings';
import { ObservatoryHero } from '@/components/public/observatory/ObservatoryHero';
import { ObservatoryPrinciples } from '@/components/public/observatory/ObservatoryPrinciples';
import { ObservatoryStudyCta } from '@/components/public/observatory/ObservatoryStudyCta';

export const metadata: Metadata = {
  title: "Seven’O - Observatoire",
  alternates: {
    canonical: '/observatoire',
  },
  description:
    "Synthèse éditoriale des premiers enseignements de l’étude Seven’O, sans chiffres ni données détaillées.",
};

export default function ObservatoryPage() {
  return (
    <PublicSiteShell>
      <div className="space-y-14 lg:space-y-20">
        <ObservatoryHero />
        <ObservatoryFindings />
        <ObservatoryPrinciples />
        <ObservatoryStudyCta />
      </div>
    </PublicSiteShell>
  );
}
