'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="ml-auto lg:hidden">
      <button
        type="button"
        aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={menuOpen}
        aria-controls="public-site-mobile-menu"
        onClick={() => setMenuOpen((value) => !value)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-100 transition hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020817]"
      >
        <MenuIcon open={menuOpen} />
      </button>

      {menuOpen ? (
        <div
          id="public-site-mobile-menu"
          className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(4,10,24,0.98),rgba(6,12,26,0.98))] lg:hidden"
        >
          <div className="mx-auto w-[calc(100%-2.5rem)] max-w-[1640px] px-5 py-4 sm:w-[calc(100%-3rem)] sm:px-8 lg:w-[calc(100%-4rem)] lg:px-10">
            <nav aria-label="Navigation principale" className="grid gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className="rounded-[16px] px-3 py-3 text-[15px] text-slate-200 transition hover:bg-white/5 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-5 border-t border-white/10 pt-5">
              <div className="flex flex-col gap-3 sm:flex-row" onClick={closeMenu}>
                <Link
                  href="/connexion"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020817] hover:border-white/20 hover:bg-white/10 sm:min-w-[8.5rem]"
                >
                  Se connecter
                </Link>
                <Link
                  href="/connexion"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020817] hover:border-cyan-300/35 hover:bg-cyan-400/15 sm:min-w-[8.5rem]"
                >
                  Créer mon profil
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
