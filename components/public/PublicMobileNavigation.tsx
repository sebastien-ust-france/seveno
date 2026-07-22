'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type PublicNavigationLink = {
  href: string;
  label: string;
};

type PublicMobileNavigationProps = {
  links: readonly PublicNavigationLink[];
};

function MenuIcon({ open }: { open: boolean }) {
  return (
    <span aria-hidden="true" className="relative block h-4 w-5">
      <span
        className={[
          'absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition-transform duration-200',
          open ? 'translate-y-2 rotate-45' : '',
        ].join(' ')}
      />
      <span
        className={[
          'absolute left-0 top-1.5 h-0.5 w-5 rounded-full bg-current transition-opacity duration-200',
          open ? 'opacity-0' : '',
        ].join(' ')}
      />
      <span
        className={[
          'absolute left-0 top-3 h-0.5 w-5 rounded-full bg-current transition-transform duration-200',
          open ? '-translate-y-2 -rotate-45' : '',
        ].join(' ')}
      />
    </span>
  );
}

export function PublicMobileNavigation({ links }: PublicMobileNavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousBodyOverflowRef = useRef('');
  const previousHtmlOverflowRef = useRef('');
  const wasOpenRef = useRef(false);
  const previousPathnameRef = useRef(pathname);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((value) => !value);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMobileMenu();
      }
    }

    function handleResize() {
      if (window.innerWidth >= 1024) {
        closeMobileMenu();
      }
    }

    previousBodyOverflowRef.current = document.body.style.overflow;
    previousHtmlOverflowRef.current = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    return () => {
      document.body.style.overflow = previousBodyOverflowRef.current;
      document.documentElement.style.overflow = previousHtmlOverflowRef.current;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [closeMobileMenu, isMobileMenuOpen]);

  useEffect(() => {
    if (wasOpenRef.current && !isMobileMenuOpen) {
      toggleButtonRef.current?.focus();
    }

    wasOpenRef.current = isMobileMenuOpen;
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      closeMobileMenu();
    }

    previousPathnameRef.current = pathname;
  }, [closeMobileMenu, pathname]);

  return (
    <div className="ml-auto lg:hidden">
      <button
        ref={toggleButtonRef}
        type="button"
        aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={isMobileMenuOpen}
        aria-controls="public-site-mobile-menu"
        onClick={toggleMobileMenu}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-100 transition hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020817]"
      >
        <MenuIcon open={isMobileMenuOpen} />
      </button>

      {isMobileMenuOpen ? (
        <div
          id="public-site-mobile-menu"
          className="fixed inset-x-0 top-[80px] z-40 h-[calc(100dvh-80px)] lg:hidden"
        >
          <div
            aria-hidden="true"
            onClick={closeMobileMenu}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px]"
          />

          <div className="relative mx-auto flex h-full w-[calc(100%-2.5rem)] max-w-[1640px] px-5 pt-4 sm:w-[calc(100%-3rem)] sm:px-8 lg:w-[calc(100%-4rem)] lg:px-10">
            <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(4,10,24,0.98),rgba(6,12,26,0.98))] shadow-[0_30px_80px_rgba(2,8,23,0.55)]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
                  Navigation
                </p>
                <button
                  type="button"
                  onClick={closeMobileMenu}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020817]"
                >
                  Fermer
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                <nav aria-label="Navigation principale" className="grid gap-1">
                  {links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMobileMenu}
                      className="rounded-[16px] px-3 py-3 text-[15px] text-slate-200 transition hover:bg-white/5 hover:text-white"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>

                <div className="mt-5 border-t border-white/10 pt-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Link
                      href="/connexion"
                      onClick={closeMobileMenu}
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020817] hover:border-white/20 hover:bg-white/10 sm:min-w-[8.5rem]"
                    >
                      Se connecter
                    </Link>
                    <Link
                      href="/connexion"
                      onClick={closeMobileMenu}
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020817] hover:border-cyan-300/35 hover:bg-cyan-400/15 sm:min-w-[8.5rem]"
                    >
                      Créer mon profil
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
