'use client';

import Link from 'next/link';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  ariaLabel?: string;
  className?: string;
};

export function Breadcrumbs({ items, ariaLabel = 'Fil d Ariane', className = '' }: BreadcrumbsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label={ariaLabel} className={className}>
      <ol className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400 sm:text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const content = item.href && !isLast ? (
            <Link
              href={item.href}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ) : (
            <span
              className={
                isLast
                  ? 'rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-cyan-100'
                  : 'px-1 text-slate-300'
              }
              aria-current={isLast ? 'page' : undefined}
            >
              {item.label}
            </span>
          );

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {content}
              {!isLast ? <span aria-hidden="true" className="text-slate-600">/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

