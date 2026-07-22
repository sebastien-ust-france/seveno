import type { Metadata } from 'next';
import { PublicSiteShell } from '@/components/public/PublicSiteShell';
import { AboutFinalCta } from '@/components/public/about/AboutFinalCta';
import { AboutHero } from '@/components/public/about/AboutHero';
import { AboutLaunch } from '@/components/public/about/AboutLaunch';
import { AboutMission } from '@/components/public/about/AboutMission';
import { AboutObservatory } from '@/components/public/about/AboutObservatory';
import { AboutOrigin } from '@/components/public/about/AboutOrigin';
import { AboutPrinciples } from '@/components/public/about/AboutPrinciples';
import { AboutUstWorkflow } from '@/components/public/about/AboutUstWorkflow';

export const metadata: Metadata = {
  title: "Seven’O - À propos",
  alternates: {
    canonical: '/a-propos',
  },
  description:
    "Comprenez l’origine de Seven’O, la mission de la plateforme, les principes qu’elle défend et le rôle de l’Observatoire.",
};

export default function AboutPublicPage() {
  return (
    <PublicSiteShell>
      <div className="space-y-8 sm:space-y-10 lg:space-y-12">
        <AboutHero />
        <AboutOrigin />
        <AboutMission />
        <AboutPrinciples />
        <AboutObservatory />
        <AboutLaunch />
        <AboutUstWorkflow />
        <AboutFinalCta />
      </div>
    </PublicSiteShell>
  );
}
