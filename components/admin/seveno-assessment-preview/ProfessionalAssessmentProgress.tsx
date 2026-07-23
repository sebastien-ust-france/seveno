'use client';

interface ProfessionalAssessmentProgressProps {
  currentIndex: number;
  total: number;
  sectionLabel: string;
  counterLabel?: string;
}

export default function ProfessionalAssessmentProgress({
  currentIndex,
  total,
  sectionLabel,
  counterLabel,
}: ProfessionalAssessmentProgressProps) {
  const currentPosition = Math.max(0, currentIndex + 1);
  const percentage = total > 0 ? Math.min(100, Math.round((currentPosition / total) * 100)) : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">{sectionLabel}</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {counterLabel ?? `Question ${currentPosition} sur ${total}`}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
          {percentage} %
        </span>
      </div>

      <div
        aria-hidden="true"
        className="h-2 rounded-full bg-white/5"
      >
        <div
          className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
