'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOutUser } from '@/lib/auth';
import { SidebarNavigationItem } from '@/components/navigation/SidebarNavigationItem';
import type { SidebarNavigationItemConfig } from '@/types/seveno-navigation';

export type AuthenticatedAppShellRole = 'candidate' | 'company' | 'admin';

type AuthenticatedAppShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  navigation: SidebarNavigationItemConfig[];
  role: AuthenticatedAppShellRole;
  children: ReactNode;
  sidebarTop?: ReactNode;
  footerNote?: ReactNode;
};

function isNavigationItemActive(pathname: string, item: SidebarNavigationItemConfig) {
  if (item.match === 'exact') {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AuthenticatedAppShell({
  eyebrow,
  title,
  description,
  navigation,
  role,
  children,
  sidebarTop,
  footerNote,
}: AuthenticatedAppShellProps) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  async function handleSignOut() {
    if (signOutLoading) {
      return;
    }

    setSignOutLoading(true);

    try {
      if (role === 'admin') {
        await fetch('/api/admin/session', {
          method: 'DELETE',
          credentials: 'include',
        }).catch(() => null);
      }

      await signOutUser().catch(() => null);
    } finally {
      router.replace('/connexion');
    }
  }

  function renderNavigation(onNavigate?: () => void) {
    return (
      <nav aria-label={eyebrow} className="space-y-2">
        {navigation.map((item) => (
          <SidebarNavigationItem
            key={item.href}
            item={item}
            active={isNavigationItemActive(pathname, item)}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_28%),linear-gradient(180deg,#020617_0%,#020817_45%,#020617_100%)] text-white">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[304px] border-r border-white/10 bg-[linear-gradient(180deg,rgba(8,15,28,0.98),rgba(6,11,22,0.96))] px-5 py-5 lg:flex">
        <div className="flex h-full w-full flex-col rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,32,0.96),rgba(8,15,28,0.9))] p-4 shadow-[0_24px_90px_rgba(2,6,23,0.34)] backdrop-blur">
          {sidebarTop ?? (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">{eyebrow}</p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">{title}</h1>
              <p className="mt-4 text-sm leading-7 text-slate-300">{description}</p>
            </div>
          )}

          <div className="mt-5 flex min-h-0 flex-1 flex-col rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Navigation</p>
            <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {renderNavigation()}
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Session</p>
            <div className="mt-3 space-y-4">
              {footerNote ? <div className="text-sm leading-6 text-slate-300">{footerNote}</div> : null}
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signOutLoading}
                className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {signOutLoading ? 'Déconnexion...' : 'Se déconnecter'}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[304px]">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[rgba(2,6,23,0.9)] backdrop-blur lg:hidden">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020817]"
              aria-label="Ouvrir la navigation"
            >
              <span aria-hidden="true" className="text-lg leading-none">☰</span>
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/80">{eyebrow}</p>
              {title ? <p className="truncate text-sm font-semibold text-white">{title}</p> : null}
            </div>

          </div>
        </header>

        <div className="relative">
          {children}
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            type="button"
            aria-label="Fermer la navigation"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
          />

          <div className="absolute inset-y-0 left-0 w-[min(86vw,22rem)] p-3">
            <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,32,0.98),rgba(8,15,28,0.96))] shadow-[0_30px_90px_rgba(2,6,23,0.5)]">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
                {sidebarTop ?? (
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">{eyebrow}</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">{title}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020817]"
                  aria-label="Fermer la navigation"
                >
                  <span aria-hidden="true" className="text-xl leading-none">×</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                  {renderNavigation(() => setDrawerOpen(false))}
                </div>
              </div>

              <div className="border-t border-white/10 p-4">
                {footerNote ? <div className="mb-4 text-sm leading-6 text-slate-300">{footerNote}</div> : null}
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  disabled={signOutLoading}
                  className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {signOutLoading ? 'Déconnexion...' : 'Se déconnecter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
