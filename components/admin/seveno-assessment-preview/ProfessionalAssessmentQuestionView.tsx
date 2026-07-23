'use client';

import type { ReactNode } from 'react';
import ProfessionalAssessmentChoiceList from '@/components/admin/seveno-assessment-preview/ProfessionalAssessmentChoiceList';
import type { AssessmentQuestion } from '@/types/seveno-assessment';

interface ProfessionalAssessmentQuestionViewProps {
  question: AssessmentQuestion;
  displayIndex: number;
  totalQuestions: number;
  sectionLabel: string;
  pathLabel: string;
  difficultyLabel: string;
  readingLabel: string;
  selectedOptionId?: string | null;
  onSelectOption?: (optionId: string) => void;
  showInternalDetails?: boolean;
  warning?: string | null;
  statusLabel?: string | null;
  internalPanel?: ReactNode;
  footer?: ReactNode;
}

export default function ProfessionalAssessmentQuestionView({
  question,
  displayIndex,
  totalQuestions,
  sectionLabel,
  pathLabel,
  difficultyLabel,
  readingLabel,
  selectedOptionId = null,
  onSelectOption,
  showInternalDetails = false,
  warning = null,
  statusLabel = null,
  internalPanel,
  footer,
}: ProfessionalAssessmentQuestionViewProps) {
  return (
    <article className="space-y-4 rounded-[28px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_30px_80px_rgba(2,6,23,0.25)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">{sectionLabel}</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            Question {displayIndex} sur {totalQuestions}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
            {pathLabel}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
            {difficultyLabel}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
            {readingLabel}
          </span>
          {statusLabel ? (
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-50">
              {statusLabel}
            </span>
          ) : null}
        </div>
      </div>

      {warning ? (
        <p className="rounded-2xl border border-orange-300/20 bg-orange-400/10 px-4 py-3 text-sm leading-7 text-orange-50">
          {warning}
        </p>
      ) : null}

      <div className="space-y-3">
        <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Situation</p>
          <p className="mt-3 text-lg font-semibold leading-8 text-white">{question.situation}</p>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Instruction</p>
          <p className="mt-3 text-sm leading-7 text-slate-200">{question.instruction}</p>
        </div>
      </div>

      <ProfessionalAssessmentChoiceList
        options={question.options}
        selectedOptionId={selectedOptionId}
        onSelectOption={onSelectOption}
        showInternalDetails={showInternalDetails}
        footer={footer}
      />

      {internalPanel ? <div>{internalPanel}</div> : null}
    </article>
  );
}
