import type { ReactNode } from 'react';
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';

type PublicSiteShellProps = {
  children: ReactNode;
};

export function PublicSiteShell({ children }: PublicSiteShellProps) {
  return (
    <div className="min-h-screen bg-[#020817] text-white">
      <PublicSiteHeader />
      <main className="mx-auto w-[calc(100%-2.5rem)] max-w-[1640px] px-5 py-8 sm:w-[calc(100%-3rem)] sm:px-8 lg:w-[calc(100%-4rem)] lg:px-10 lg:py-12">
        {children}
      </main>
      <PublicSiteFooter />
    </div>
  );
}
