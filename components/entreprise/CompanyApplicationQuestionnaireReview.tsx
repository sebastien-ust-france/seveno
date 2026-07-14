'use client';

import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import type {
  CompanyApplicationQuestionnaireAnswerRecord,
  CompanyApplicationQuestionnaireReviewView,
} from '@/types/seveno-application-questionnaires';

type ReviewQuestion = NonNullable<CompanyApplicationQuestionnaireReviewView['questionnaire']>['questions'][number];

const BOOLEAN_OPTIONS = [
  { value: true, label: 'Oui' },
  { value: false, label: 'Non' },
] as const;

function isChoiceQuestion(question: ReviewQuestion) {
  return question.type === 'single_choice' || question.type === 'multiple_choice' || question.type === 'boolean';
}

function getAnswerByQuestionId(
  answers: CompanyApplicationQuestionnaireAnswerRecord[],
  questionId: string,
) {
  return answers.find((answer) => answer.questionId === questionId) ?? null;
}

function getCorrectOptionIds(question: ReviewQuestion) {
  if (question.type === 'single_choice' && typeof question.expectedAnswer === 'string') {
    return [question.expectedAnswer];
  }
  if (question.type === 'multiple_choice' && Array.isArray(question.expectedAnswer)) {
    return question.expectedAnswer.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

function getSelectedOptionIds(answer: CompanyApplicationQuestionnaireAnswerRecord | null) {
  if (!answer) {
    return [];
  }
  if (typeof answer.answerValue === 'string') {
    return answer.answerValue ? [answer.answerValue] : [];
  }
  if (Array.isArray(answer.answerValue)) {
    return answer.answerValue.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }
  return [];
}

function getOptionLabel(question: ReviewQuestion, optionId: string) {
  return question.options.find((option) => option.id === optionId)?.label ?? optionId;
}

function formatExpectedAnswer(question: ReviewQuestion) {
  if (question.expectedAnswer === undefined) {
    return question.correctionMode === 'manual'
      ? 'Correction manuelle'
      : 'Aucune bonne réponse définie';
  }

  if (question.type === 'single_choice') {
    return typeof question.expectedAnswer === 'string'
      ? getOptionLabel(question, question.expectedAnswer)
      : String(question.expectedAnswer);
  }

  if (question.type === 'multiple_choice') {
    const ids = Array.isArray(question.expectedAnswer)
      ? question.expectedAnswer.filter((item): item is string => typeof item === 'string')
      : typeof question.expectedAnswer === 'string'
        ? [question.expectedAnswer]
        : [];
    return ids.map((id) => getOptionLabel(question, id)).join(', ');
  }

  if (question.type === 'boolean') {
    return question.expectedAnswer === true ? 'Oui' : 'Non';
  }

  if (question.type === 'number') {
    const prefix = question.numberOperator === 'minimum'
      ? 'Minimum'
      : question.numberOperator === 'maximum'
        ? 'Maximum'
        : 'Exactement';
    return `${prefix} ${question.expectedAnswer}`;
  }

  if (typeof question.expectedAnswer === 'string') {
    return question.expectedAnswer;
  }

  return String(question.expectedAnswer);
}

function formatCandidateAnswer(question: ReviewQuestion, answer: CompanyApplicationQuestionnaireAnswerRecord | null) {
  if (!answer || answer.answerValue === null || answer.answeredAt === null) {
    return 'Aucune réponse';
  }

  if (question.type === 'single_choice') {
    return typeof answer.answerValue === 'string' ? getOptionLabel(question, answer.answerValue) : 'Réponse invalide';
  }

  if (question.type === 'multiple_choice') {
    if (!Array.isArray(answer.answerValue) || answer.answerValue.length === 0) {
      return 'Aucune réponse';
    }
    return answer.answerValue.map((optionId) => getOptionLabel(question, optionId)).join(', ');
  }

  if (question.type === 'boolean') {
    return answer.answerValue === true ? 'Oui' : 'Non';
  }

  if (question.type === 'number') {
    return typeof answer.answerValue === 'number' ? String(answer.answerValue) : 'Réponse invalide';
  }

  if (typeof answer.answerValue === 'string') {
    return answer.answerValue;
  }

  return 'Réponse invalide';
}

function resultTone(answer: CompanyApplicationQuestionnaireAnswerRecord | null) {
  if (!answer || answer.answerValue === null || answer.answeredAt === null) {
    return 'neutral';
  }
  if (answer.automaticResult === 'correct') {
    return 'correct';
  }
  if (answer.automaticResult === 'incorrect') {
    return 'incorrect';
  }
  if (answer.automaticResult === 'manual') {
    return 'manual';
  }
  return 'neutral';
}

function toneClasses(tone: 'neutral' | 'correct' | 'incorrect' | 'manual') {
  if (tone === 'correct') {
    return 'border-emerald-300/30 bg-emerald-400/10 text-emerald-50';
  }
  if (tone === 'incorrect') {
    return 'border-rose-300/30 bg-rose-400/10 text-rose-50';
  }
  if (tone === 'manual') {
    return 'border-orange-300/30 bg-orange-400/10 text-orange-50';
  }
  return 'border-white/10 bg-white/5 text-slate-200';
}

function formatQuestionTone(answer: CompanyApplicationQuestionnaireAnswerRecord | null) {
  if (!answer || answer.answerValue === null || answer.answeredAt === null) {
    return 'Non répondu';
  }
  if (answer.automaticResult === 'correct') {
    return 'Réponse correcte';
  }
  if (answer.automaticResult === 'incorrect') {
    return 'Réponse incorrecte';
  }
  if (answer.automaticResult === 'manual') {
    return 'Correction manuelle';
  }
  return 'Réponse transmise';
}

function renderOptionState(
  question: ReviewQuestion,
  answer: CompanyApplicationQuestionnaireAnswerRecord | null,
  optionId: string,
) {
  const correctOptionIds = getCorrectOptionIds(question);
  const selectedOptionIds = getSelectedOptionIds(answer);
  const isSelected = selectedOptionIds.includes(optionId);
  const isCorrect = correctOptionIds.includes(optionId);

  if (answer?.automaticResult === 'manual') {
    if (isSelected) {
      return 'border-orange-300/40 bg-orange-400/10 text-orange-50';
    }
    return 'border-white/10 bg-white/5 text-slate-200';
  }

  if (isSelected && isCorrect) {
    return 'border-emerald-300/40 bg-emerald-400/10 text-emerald-50';
  }
  if (isSelected && !isCorrect) {
    return 'border-rose-300/40 bg-rose-400/10 text-rose-50';
  }
  if (isCorrect) {
    return 'border-emerald-300/30 bg-emerald-400/5 text-emerald-50';
  }
  return 'border-white/10 bg-white/5 text-slate-200';
}

function renderBooleanState(
  answer: CompanyApplicationQuestionnaireAnswerRecord | null,
  optionValue: boolean,
  expectedAnswer: boolean | undefined,
) {
  if (answer?.automaticResult === 'manual') {
    return answer.answerValue === optionValue
      ? 'border-orange-300/40 bg-orange-400/10 text-orange-50'
      : 'border-white/10 bg-white/5 text-slate-200';
  }

  const selected = answer?.answerValue === optionValue;
  const correct = typeof expectedAnswer === 'boolean' && expectedAnswer === optionValue;
  if (selected && correct) {
    return 'border-emerald-300/40 bg-emerald-400/10 text-emerald-50';
  }
  if (selected && !correct) {
    return 'border-rose-300/40 bg-rose-400/10 text-rose-50';
  }
  if (correct) {
    return 'border-emerald-300/30 bg-emerald-400/5 text-emerald-50';
  }
  return 'border-white/10 bg-white/5 text-slate-200';
}

export function CompanyApplicationQuestionnaireReview({
  review,
}: {
  review: CompanyApplicationQuestionnaireReviewView | null;
}) {
  if (!review?.questionnaire) {
    return null;
  }

  const { questionnaire, assessment, answers } = review;
  const answerCount = answers.filter((answer) => answer.answeredAt !== null && answer.answerValue !== null).length;
  const correctCount = answers.filter((answer) => answer.automaticResult === 'correct').length;

  return (
    <SevenoPanel tone="neutral" className="p-5" id="questionnaire-candidat">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Questionnaire du candidat</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">{questionnaire.title}</h3>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">
            {questionnaire.instructions || 'Questionnaire associé à cette candidature.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {questionnaire.questions.length} question(s)
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {questionnaire.durationMinutes ? `${questionnaire.durationMinutes} minute(s)` : 'Sans limite de temps'}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {assessment?.status === 'completed'
                ? 'Terminé'
                : assessment?.status === 'submitted'
                  ? 'Réponses reçues'
                  : assessment?.status === 'in_progress'
                    ? 'En cours'
                    : assessment?.status === 'expired'
                      ? 'Expiré'
                      : 'Non démarré'}
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
          <article className="rounded-[22px] border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Score</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {assessment?.finalScore !== null && assessment?.finalScore !== undefined
                ? `${Math.round(assessment.finalScore)}%`
                : assessment?.automaticScorePercent !== null && assessment?.automaticScorePercent !== undefined
                  ? `${Math.round(assessment.automaticScorePercent)}%`
                  : 'En attente'}
            </p>
          </article>
          <article className="rounded-[22px] border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Réponses traitées</p>
            <p className="mt-2 text-lg font-semibold text-white">{answerCount}/{questionnaire.questions.length}</p>
          </article>
        </div>
      </div>

      {assessment?.manualReviewRequired ? (
        <div className="mt-5 rounded-2xl border border-orange-300/20 bg-orange-400/10 px-4 py-4 text-sm leading-7 text-orange-100">
          Certaines réponses nécessitent encore une validation manuelle. Les réponses correctes sont en vert, les
          réponses erronées du candidat en rouge.
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-4 text-sm leading-7 text-emerald-100">
          {correctCount}/{answers.length} réponse(s) automatiques correctes.
        </div>
      )}

      <div className="mt-6 space-y-4">
        {questionnaire.questions.map((question, index) => {
          const answer = getAnswerByQuestionId(answers, question.id);
          const tone = resultTone(answer);
          const candidateAnswerLabel = formatCandidateAnswer(question, answer);
          const expectedAnswerLabel = formatExpectedAnswer(question);

          return (
            <article key={question.id} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                    Question {index + 1} sur {questionnaire.questions.length}
                  </p>
                  <h4 className="mt-2 text-lg font-semibold text-white">{question.prompt}</h4>
                  {question.help ? <p className="mt-2 text-sm leading-7 text-slate-400">{question.help}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {question.type === 'single_choice'
                      ? 'Choix unique'
                      : question.type === 'multiple_choice'
                        ? 'Choix multiple'
                        : question.type === 'boolean'
                          ? 'Oui / Non'
                          : question.type === 'number'
                            ? 'Numérique'
                            : question.type === 'short_text'
                              ? 'Texte court'
                              : 'Texte long'}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {question.points} point(s)
                  </span>
                  <span className={`rounded-full border px-3 py-1 ${toneClasses(tone)}`}>
                    {formatQuestionTone(answer)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {answer?.awardedPoints !== null && answer?.awardedPoints !== undefined
                      ? `${answer.awardedPoints} pt(s)`
                      : question.correctionMode === 'manual'
                        ? 'À valider manuellement'
                        : '0 pt'}
                  </span>
                </div>
              </div>

              {isChoiceQuestion(question) ? (
                <div className="mt-5 space-y-3">
                  {question.type === 'boolean'
                    ? BOOLEAN_OPTIONS.map((option) => (
                        <div
                          key={option.label}
                          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${renderBooleanState(answer, option.value, question.expectedAnswer as boolean | undefined)}`}
                        >
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-current/20 text-xs font-semibold">
                            {option.label}
                          </span>
                          <span className="font-medium">{option.label}</span>
                        </div>
                      ))
                    : question.options.map((option) => (
                        <div
                          key={option.id}
                          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${renderOptionState(question, answer, option.id)}`}
                        >
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-current/20 text-xs font-semibold">
                            {option.order}
                          </span>
                          <span className="font-medium">{option.label}</span>
                          {getCorrectOptionIds(question).includes(option.id) ? (
                            <span className="ml-auto rounded-full border border-current/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]">
                              Bonne réponse
                            </span>
                          ) : null}
                        </div>
                      ))}
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <article className={`rounded-2xl border p-4 text-sm ${tone === 'incorrect' ? 'border-rose-300/30 bg-rose-400/10 text-rose-50' : tone === 'correct' ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-50' : tone === 'manual' ? 'border-orange-300/30 bg-orange-400/10 text-orange-50' : 'border-white/10 bg-white/5 text-slate-200'}`}>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-200/70">Réponse du candidat</p>
                  <p className="mt-2 font-medium text-white">{candidateAnswerLabel}</p>
                </article>

                <article className="rounded-2xl border border-emerald-300/30 bg-emerald-400/5 p-4 text-sm text-emerald-50">
                  <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Bonne réponse</p>
                  <p className="mt-2 font-medium text-white">{expectedAnswerLabel}</p>
                </article>
              </div>
            </article>
          );
        })}
      </div>
    </SevenoPanel>
  );
}
