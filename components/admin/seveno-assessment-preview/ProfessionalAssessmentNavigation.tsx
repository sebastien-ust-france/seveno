'use client';

interface ProfessionalAssessmentNavigationProps {
  currentIndex: number;
  total: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onJump: (index: number) => void;
  label?: string;
}

export default function ProfessionalAssessmentNavigation({
  currentIndex,
  total,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  onJump,
  label = 'Accès direct',
}: ProfessionalAssessmentNavigationProps) {
  if (total <= 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Question précédente
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Question suivante
      </button>
      <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
        <span className="whitespace-nowrap text-xs uppercase tracking-[0.24em] text-slate-400">{label}</span>
        <select
          value={String(currentIndex)}
          onChange={(event) => onJump(Number(event.target.value))}
          className="bg-transparent text-sm text-white outline-none"
        >
          {Array.from({ length: total }, (_, index) => index).map((index) => (
            <option key={index} value={index}>
              Question {index + 1}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
