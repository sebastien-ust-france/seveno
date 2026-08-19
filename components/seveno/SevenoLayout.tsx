'use client';

import type { HTMLAttributes, ReactNode } from 'react';

export type SevenoTone = 'cyan' | 'blue' | 'orange' | 'neutral';

const SURFACE_CONTAINER_CLASS = 'mx-auto flex min-h-screen w-full items-center justify-center px-5 py-10 sm:px-8';
const SURFACE_SECTION_CLASS =
  'relative w-full overflow-hidden rounded-[32px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.96),rgba(8,15,28,0.94))] p-6 shadow-[0_24px_90px_rgba(2,6,23,0.42)] backdrop-blur sm:p-8';

const PANEL_CLASSES: Record<SevenoTone, string> = {
  cyan: 'border-cyan-400/15 bg-[linear-gradient(180deg,rgba(9,17,32,0.96),rgba(8,15,28,0.92))] shadow-[0_20px_60px_rgba(2,6,23,0.22)]',
  blue:
    'border-blue-400/15 bg-[linear-gradient(180deg,rgba(13,14,34,0.96),rgba(8,15,28,0.92))] shadow-[0_20px_60px_rgba(2,6,23,0.22)]',
  orange:
    'border-orange-400/15 bg-[linear-gradient(180deg,rgba(18,15,24,0.96),rgba(8,15,28,0.92))] shadow-[0_20px_60px_rgba(2,6,23,0.22)]',
  neutral:
    'border-white/10 bg-[linear-gradient(180deg,rgba(10,15,28,0.92),rgba(8,15,28,0.86))] shadow-[0_18px_60px_rgba(2,6,23,0.22)]',
};

type SevenoSurfaceProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  containerClassName?: string;
  sectionClassName?: string;
};

export function SevenoSurface({
  eyebrow,
  title,
  description,
  actions,
  footer,
  children,
  containerClassName = '',
  sectionClassName = '',
}: SevenoSurfaceProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_28%),linear-gradient(180deg,#020617_0%,#020817_45%,#020617_100%)] text-white">
      <div className={`${SURFACE_CONTAINER_CLASS} ${containerClassName}`.trim()}>
        <section className={`${SURFACE_SECTION_CLASS} ${sectionClassName}`.trim()}>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgb(var(--seveno-brand-blue)/0.10),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.08),transparent_28%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent"
          />

          <div className="relative z-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">{eyebrow}</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">{description}</p>
              </div>

              {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
            </div>

            <div className="mt-8">{children}</div>

            {footer ? <div className="mt-6">{footer}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

type SevenoPanelProps = HTMLAttributes<HTMLDivElement> & {
  tone?: SevenoTone;
};

export function SevenoPanel({ tone = 'neutral', className = '', children, ...props }: SevenoPanelProps) {
  return (
    <div
      {...props}
      className={`relative overflow-hidden rounded-[24px] border p-5 transition-all duration-300 ease-out transform-gpu ${PANEL_CLASSES[tone]} ${className}`.trim()}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0)_24%),radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_64%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
