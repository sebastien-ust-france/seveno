'use client';

import type { ReactNode } from 'react';
import { SevenoPanel, type SevenoTone } from '@/components/seveno/SevenoLayout';

type CandidateStatusCardProps = {
  tone?: SevenoTone;
  label: string;
  value: string | number;
  note: string;
  action?: ReactNode;
};

export function CandidateStatusCard({ tone = 'neutral', label, value, note, action }: CandidateStatusCardProps) {
  return (
    <SevenoPanel tone={tone} className="p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">{label}</p>
      <p className="mt-3 text-lg font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{note}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </SevenoPanel>
  );
}
