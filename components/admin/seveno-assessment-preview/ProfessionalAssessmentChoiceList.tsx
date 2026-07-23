'use client';

import type { ReactNode } from 'react';
import type { AssessmentQuestionOption } from '@/types/seveno-assessment';

interface ProfessionalAssessmentChoiceListProps {
  options: AssessmentQuestionOption[];
  selectedOptionId?: string | null;
  onSelectOption?: (optionId: string) => void;
  showInternalDetails?: boolean;
  footer?: ReactNode;
}

function formatDimensionScores(option: AssessmentQuestionOption) {
  const entries = Object.entries(option.dimensionScores ?? {});
  if (entries.length === 0) {
    return 'Aucun score renseigné';
  }

  return entries
    .map(([dimensionCode, score]) => `${dimensionCode}: ${score}`)
    .join(' · ');
}

export default function ProfessionalAssessmentChoiceList({
  options,
  selectedOptionId = null,
  onSelectOption,
  showInternalDetails = false,
  footer,
}: ProfessionalAssessmentChoiceListProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => {
          const selected = selectedOptionId === option.id;
          const sharedClasses = [
            'rounded-[20px] border px-4 py-4 text-left transition',
            selected
              ? 'border-cyan-300/40 bg-cyan-400/10 text-white shadow-[0_0_0_1px_rgba(103,232,249,0.14)]'
              : 'border-white/10 bg-white/5 text-slate-100 hover:border-cyan-300/20 hover:bg-white/10',
          ].join(' ');

          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold">
                  {option.label}
                </p>
                <span className="rounded-full border border-white/10 bg-black/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                  Réponse {String.fromCharCode(64 + option.position)}
                </span>
              </div>

              {showInternalDetails ? (
                <div className="mt-3 space-y-2 text-xs leading-6 text-slate-300">
                  <p>{formatDimensionScores(option)}</p>
                  <p className="text-slate-400">{option.adminExplanation}</p>
                </div>
              ) : null}
            </>
          );

          if (onSelectOption) {
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelectOption(option.id)}
                className={sharedClasses}
              >
                {content}
              </button>
            );
          }

          return (
            <article key={option.id} className={sharedClasses}>
              {content}
            </article>
          );
        })}
      </div>

      {footer ? <div>{footer}</div> : null}
    </div>
  );
}
