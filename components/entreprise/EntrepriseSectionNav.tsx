'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/entreprise', label: 'Tableau de bord' },
  { href: '/entreprise/offres', label: 'Mes offres' },
  { href: '/entreprise/demandes', label: 'Mises en relation' },
  { href: '/entreprise/onboarding', label: 'Mon entreprise' },
];

export default function EntrepriseSectionNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Navigation entreprise" className="flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const active = link.href === '/entreprise' ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={active
              ? 'rounded-full border border-cyan-300/30 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-100'
              : 'rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10'}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
