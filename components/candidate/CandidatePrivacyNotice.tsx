'use client';

import { SevenoPanel } from '@/components/seveno/SevenoLayout';

type CandidatePrivacyNoticeProps = {
  title?: string;
  message: string;
};

export function CandidatePrivacyNotice({
  title = 'Anonymat préservé',
  message,
}: CandidatePrivacyNoticeProps) {
  return (
    <SevenoPanel tone="violet" className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.14),rgba(139,92,246,0.10),rgba(249,115,22,0.08))] text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_0_24px_rgba(34,211,238,0.10)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M12 3.5 18.5 6v5.2c0 4.3-2.8 7.4-6.5 9.3-3.7-1.9-6.5-5-6.5-9.3V6L12 3.5Z" />
            <path d="m9.5 12 1.8 1.8 3.2-3.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-2 text-sm leading-7 text-slate-300">{message}</p>
        </div>
      </div>
    </SevenoPanel>
  );
}
