'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SevenoPanel } from '@/components/seveno/SevenoLayout';

const ADMIN_SECTION_LINKS = [
  { href: '/admin', label: 'Tableau de bord' },
  { href: '/admin/etude', label: 'Etude' },
  { href: '/admin/candidats', label: 'Candidats' },
  { href: '/admin/entreprises', label: 'Entreprises' },
  { href: '/admin/tests', label: 'Tests' },
  { href: '/admin/prerequis', label: 'Prerequis' },
  { href: '/admin/mises-en-relation', label: 'Mises en relation' },
  { href: '/admin/journal', label: 'Journal' },
] as const;

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSectionNav() {
  const pathname = usePathname();

  return (
    <SevenoPanel tone="neutral" className="p-3">
      <nav aria-label="Navigation administration" className="flex gap-2 overflow-x-auto pb-1">
        {ADMIN_SECTION_LINKS.map((link) => {
          const active = isActivePath(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={[
                'inline-flex shrink-0 items-center rounded-full px-4 py-2 text-sm font-medium transition',
                active
                  ? 'border border-cyan-300/25 bg-cyan-400/12 text-cyan-50'
                  : 'border border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white',
              ].join(' ')}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </SevenoPanel>
  );
}
