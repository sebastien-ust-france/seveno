'use client';

import type { ReactNode } from 'react';
import { SevenoSurface } from '@/components/seveno/SevenoLayout';

type CandidateShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
  containerClassName?: string;
};

export function CandidateShell({
  title,
  description,
  children,
  footer,
  actions,
  containerClassName = 'max-w-[86.4rem]',
}: CandidateShellProps) {
  return (
    <SevenoSurface
      eyebrow="Espace candidat"
      title={title}
      description={description}
      actions={actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : undefined}
      containerClassName={containerClassName}
    >
      <div className="space-y-6">
        {children}
      </div>

      {footer ? <div className="mt-6">{footer}</div> : null}
    </SevenoSurface>
  );
}
