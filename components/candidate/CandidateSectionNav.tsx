'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/candidat', label: 'Tableau de bord' },
  { href: '/candidat/onboarding', label: 'Mon profil' },
  { href: '/candidat/identite', label: 'Mon identite' },
  { href: '/candidat/recommandations', label: 'Recommandations' },
];

export default function CandidateSectionNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Navigation candidat" className="flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const active = link.href === '/candidat'
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={active
              ? 'rounded-full border border-cyan-300/30 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-100'
              : 'rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10'}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
