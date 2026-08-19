export function buildSevenoAutoTimeoutQuestionKey(sessionId: string, questionId: string, currentQuestionIndex: number) {
  return `${sessionId}:${questionId}:${currentQuestionIndex}`;
}

export function shouldArmSevenoAutoTimeoutQuestion(params: {
  activeSessionPresent: boolean;
  questionnaireCompleted: boolean;
  submitting: boolean;
  currentQuestionKey: string | null;
  remainingQuestionSeconds: number | null;
}) {
  return params.activeSessionPresent
    && !params.questionnaireCompleted
    && !params.submitting
    && params.currentQuestionKey !== null
    && params.remainingQuestionSeconds !== null
    && params.remainingQuestionSeconds > 0;
}

export function shouldTriggerSevenoAutoTimeoutQuestion(params: {
  activeSessionPresent: boolean;
  questionnaireCompleted: boolean;
  submitting: boolean;
  currentQuestionKey: string | null;
  remainingQuestionSeconds: number | null;
  armedQuestionKey: string | null;
  consumedQuestionKey: string | null;
}) {
  return params.activeSessionPresent
    && !params.questionnaireCompleted
    && !params.submitting
    && params.currentQuestionKey !== null
    && params.remainingQuestionSeconds === 0
    && params.armedQuestionKey === params.currentQuestionKey
    && params.consumedQuestionKey !== params.currentQuestionKey;
}
