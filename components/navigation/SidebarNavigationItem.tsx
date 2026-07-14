'use client';

import Link from 'next/link';
import type { SidebarNavigationItemConfig } from '@/types/seveno-navigation';

type SidebarNavigationItemProps = {
  item: SidebarNavigationItemConfig;
  active: boolean;
  onNavigate?: () => void;
};

export function SidebarNavigationItem({ item, active, onNavigate }: SidebarNavigationItemProps) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={[
        'inline-flex w-full items-center rounded-full px-4 py-3 text-sm font-medium transition',
        active
          ? 'border border-cyan-300/30 bg-cyan-400/15 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]'
          : 'border border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white',
      ].join(' ')}
    >
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  );
}
