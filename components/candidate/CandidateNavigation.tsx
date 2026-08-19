'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type CandidateNavigationItem = {
  href: string;
  label: string;
  hint: string;
};

const NAV_ITEMS: CandidateNavigationItem[] = [
  {
    href: '/candidat',
    label: 'Tableau de bord',
    hint: 'Vue générale',
  },
  {
    href: '/candidat/onboarding',
    label: 'Mon profil',
    hint: 'Profil métier',
  },
  {
    href: '/candidat/identite',
    label: 'Mon identité',
    hint: 'Coordonnées privées',
  },
  {
    href: '/candidat/recommandations',
    label: 'Recommandations',
    hint: 'Avis recueillis',
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/candidat') {
    return pathname === '/candidat';
  }

  return pathname.startsWith(href);
}

export function CandidateNavigation() {
  const pathname = usePathname() ?? '';

  return (
    <nav
      aria-label="Navigation candidat"
      className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={
              'group inline-flex min-w-[180px] flex-col rounded-full border px-4 py-3 text-left transition duration-200 ease-out ' +
              (active
                ? 'border-cyan-300/30 bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgb(var(--seveno-brand-blue)/0.10),rgba(249,115,22,0.08))] text-white shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_16px_40px_rgba(2,6,23,0.25)]'
                : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10')
            }
          >
            <span className="text-sm font-semibold">{item.label}</span>
            <span className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400 group-hover:text-slate-300">
              {item.hint}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
