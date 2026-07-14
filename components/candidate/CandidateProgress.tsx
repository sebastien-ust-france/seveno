'use client';

import { SevenoPanel } from '@/components/seveno/SevenoLayout';

export type CandidateProgressState = 'done' | 'current' | 'todo' | 'blocked';

export type CandidateProgressStep = {
  label: string;
  description: string;
  state: CandidateProgressState;
};

const STATE_STYLES: Record<CandidateProgressState, { dot: string; badge: string; border: string }> = {
  done: {
    dot: 'bg-emerald-300 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]',
    badge: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
    border: 'border-emerald-300/20',
  },
  current: {
    dot: 'bg-cyan-300 shadow-[0_0_0_6px_rgba(34,211,238,0.12)]',
    badge: 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100',
    border: 'border-cyan-300/20',
  },
  todo: {
    dot: 'bg-slate-500 shadow-[0_0_0_6px_rgba(100,116,139,0.12)]',
    badge: 'border-white/10 bg-white/5 text-slate-200',
    border: 'border-white/10',
  },
  blocked: {
    dot: 'bg-orange-300 shadow-[0_0_0_6px_rgba(249,115,22,0.14)]',
    badge: 'border-orange-300/20 bg-orange-400/10 text-orange-100',
    border: 'border-orange-300/20',
  },
};

const STATE_LABELS: Record<CandidateProgressState, string> = {
  done: 'Terminé',
  current: 'En cours',
  todo: 'À faire',
  blocked: 'Bloqué',
};

type CandidateProgressProps = {
  steps: CandidateProgressStep[];
};

export function CandidateProgress({ steps }: CandidateProgressProps) {
  return (
    <SevenoPanel tone="neutral" className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Parcours candidat</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Les étapes de progression</h2>
        </div>
        <p className="text-sm text-slate-400">Une lecture simple du statut candidat.</p>
      </div>

      <ol className="mt-5 grid gap-3 lg:grid-cols-5">
        {steps.map((step, index) => {
          const styles = STATE_STYLES[step.state];

          return (
            <li
              key={step.label}
              className={
                'relative overflow-hidden rounded-[22px] border p-4 transition duration-300 ease-out ' +
                styles.border +
                ' bg-[linear-gradient(180deg,rgba(9,17,32,0.95),rgba(8,15,28,0.9))] shadow-[0_18px_60px_rgba(2,6,23,0.22)]'
              }
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0)_24%),radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_64%)]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
              />

              <div className="relative z-10">
                <div className="flex items-center gap-3">
                  <span className={'h-3.5 w-3.5 rounded-full ' + styles.dot} />
                  <span className={'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ' + styles.badge}>
                    {STATE_LABELS[step.state]}
                  </span>
                </div>

                <p className="mt-4 text-sm font-semibold text-white">{step.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{step.description}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">
                  {String(index + 1).padStart(2, '0')}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </SevenoPanel>
  );
}
